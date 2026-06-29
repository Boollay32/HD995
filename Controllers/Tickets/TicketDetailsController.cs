using HelpDeskNet8.Controllers.Shared;
using System.Linq;
using HelpDeskNet8.Controllers.Tasks;
using HelpDeskNet8.Infrastructure;
using HelpDeskNet8.Interfaces.Attachments;
using HelpDeskNet8.Interfaces.Notes;
using HelpDeskNet8.Interfaces.Shared;
using HelpDeskNet8.Interfaces.Tasks;
using HelpDeskNet8.Interfaces.Tickets;
using HelpDeskNet8.Interfaces.Users;
using HelpDeskNet8.Models.Attachments;
using HelpDeskNet8.Models.Notes;
using HelpDeskNet8.Models.Shared;
using HelpDeskNet8.Models.Tasks;
using HelpDeskNet8.Requests;
using Microsoft.AspNetCore.Mvc;

namespace HelpDeskNet8.Controllers.Tickets
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class TicketDetailsController(
        ITicketManager ticketManager,
        INoteManager noteManager,
        ITaskManager taskManager,
        IAttachmentManager attachmentManager,
        IHistory history,
        INotificationService notificationService) : ControllerBase
    {
        private readonly ITicketManager _ticketManager = ticketManager;
        private readonly INoteManager _noteManager = noteManager;
        private readonly ITaskManager _taskManager = taskManager;
        private readonly IAttachmentManager _attachmentManager = attachmentManager;
        private readonly IHistory _history = history;
        private readonly INotificationService _notificationService = notificationService;

        // -------------------------  Ticket  ------------------------- //

        [HttpPost]
        public async Task<IActionResult> GetTicketDetail([FromBody] GetTicketDetailRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();

            if (request.TicketId <= 0) return BadRequest("Invalid ticket ID.");

            var ticket = await _ticketManager.GetTicketDetail(request.TicketId, user);
            if (ticket == null) return NotFound();

            // IDOR guard: a non-Govtech caller may only open a ticket in their own authority.
            if (user.AuthorityID != Constants.Authority.Govtech && ticket.UserAuthorityID != user.AuthorityID)
                return NotFound();

            return Ok(ticket);
        }

        // -------------------------  Notes  ------------------------- //

        [HttpPost]
        public async Task<IActionResult> GetNotes([FromBody] GetNotesRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();

            if (request.TicketId <= 0) return BadRequest("Invalid ticket ID.");

            if (await CannotSeeTicket(user, request.TicketId)) return NotFound();

            var notes = await _noteManager.GetNotes(user, request.TicketId);
            return Ok(notes);
        }

        [HttpPost]
        public async Task<IActionResult> SaveNote([FromBody] SaveNoteRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();

            var note = NoteMapper.Map(request.ObjectInfo);
            if (note == null) return BadRequest("Invalid note data.");

            if (string.IsNullOrWhiteSpace(note.NoteDescription))
                return BadRequest("Note description is required.");

            // Editing an existing note (NoteID present): only the creator may
            // edit it. Verify ownership server-side -- the client hides the edit
            // affordance for non-creators, but that is UX only, not security.
            if (note.NoteID.HasValue && note.NoteID.Value != 0)
            {
                var existing = (await _noteManager.GetNotes(user, note.TicketID ?? 0))
                    .FirstOrDefault(n => n.NoteID == note.NoteID.Value);
                if (existing == null)
                    return NotFound("Note not found.");
                if (existing.NotesUserID != user.UserID)
                    return StatusCode(403, "You can only edit your own notes.");
            }

            var attachments = _mapAttachments(request.Attachments);

            // Stamp server-side user fields
            note.NotesUserID = user.UserID;
            note.AuthorityID = user.AuthorityID;

            var result = await _noteManager.SaveNote(
                note,
                attachments,
                user.UserID,
                rfc: request.RFC,
                UTC: request.UTC);

            if (!result.IsSuccess)
                return BadRequest(result.Error);

            // Notify on a ticket reply (RFC notes are internal-only, no routing).
            // New notes only: editing an existing note (NoteID present) must not
            // re-send the reply notification -- an edit is not a new reply.
            // The OPENING note (IsOriginal) is the creation description, not a
            // reply: it must NOT email the originator. Instead notify the
            // helpdesk that a new ticket was raised. HD35 B1/B3.
            bool isNewNote = !(note.NoteID.HasValue && note.NoteID.Value != 0);
            if (!request.RFC && isNewNote)
            {
                if (request.IsOriginal)
                    await _notificationService.Notify(note.TicketID ?? 0, NotificationType.TicketCreated, user);
                else
                    await _notificationService.Notify(note.TicketID ?? 0, NotificationType.NoteResponded, user,
                        new NotificationContext { NoteVisibleToClient = note.VisibleToClient });
            }

            // Return updated notes so UI can re-render without a second call
            var notes = await _noteManager.GetNotes(user, note.TicketID ?? 0);
            return Ok(notes);
        }

        // -------------------------  Tasks  ------------------------- //

        [HttpPost]
        public async Task<IActionResult> GetTasks([FromBody] GetTasksRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();

            // Reuse TicketFilterMapper — same Dictionary<string,string> pattern
            var filter = TicketFilterMapper.Map(request.Filters);

            var tasks = await _taskManager.GetTasks(user, filter, UTC: 0);
            return Ok(tasks);
        }

        [HttpPost]
        public async Task<IActionResult> SaveTask([FromBody] SaveTaskRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();

            var task = TaskMapper.Map(request.ObjectInfo);
            if (task == null) return BadRequest("Invalid task data.");

            if (string.IsNullOrWhiteSpace(task.Title))
                return BadRequest("Task title is required.");

            var attachments = _mapAttachments(request.Attachments);

            // Stamp server-side user
            task.UserID = user.UserID;

            // HD43: detect create vs update vs status-change to route the task
            // notification. The old status must be read BEFORE the save mutates it.
            bool isNewTask = !(task.TaskID.HasValue && task.TaskID.Value != 0);
            int? oldTaskStatus = null;
            if (!isNewTask)
            {
                var beforeTask = (await _taskManager.GetTaskDetail(user, task.TaskID.Value)).FirstOrDefault();
                oldTaskStatus = beforeTask?.Status;
            }

            var result = await _taskManager.SaveTask(
                task,
                attachments,
                user.UserID,
                UTC: 0);

            if (!result.IsSuccess)
                return BadRequest(result.Error);

            // HD43: route the task event (create / update / status change) with
            // a context carrying the title, assignee name and old->new status.
            NotificationType taskType = isNewTask
                ? NotificationType.TaskCreated
                : (oldTaskStatus != task.Status
                    ? NotificationType.TaskStatusChanged
                    : NotificationType.TaskUpdated);
            await _notificationService.Notify(task.TicketID ?? 0, taskType, user,
                new NotificationContext
                {
                    TaskTitle = task.Title,
                    TaskAssigneeName = task.AssignedTech,
                    OldTaskStatus = oldTaskStatus,
                    NewTaskStatus = task.Status,
                });

            // Return updated task list scoped to same ticket
            var filter = new Filter { TicketID = task.TicketID };
            var tasks = await _taskManager.GetTasks(user, filter, UTC: 0);
            return Ok(tasks);
        }

        // -------------------------  Activity  ------------------------- //

        [HttpPost]
        public async Task<IActionResult> GetActivity([FromBody] GetHistoryRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();

            if (request.TicketId <= 0) return BadRequest("Invalid ticket ID.");

            if (await CannotSeeTicket(user, request.TicketId)) return NotFound();

            var activity = await _history.GetHistory(user, request.TicketId);
            return Ok(activity);
        }

        // -------------------------  Private helpers  ------------------------- //

        // IDOR guard: non-Govtech callers may only act on tickets in their own authority.
        private async Task<bool> CannotSeeTicket(IUser user, int ticketId)
        {
            if (user.AuthorityID == Constants.Authority.Govtech) return false;
            var t = await _ticketManager.GetTicketDetail(ticketId, user);
            return t == null || t.UserAuthorityID != user.AuthorityID;
        }

        private static IEnumerable<IAttachment> _mapAttachments(
            IEnumerable<IAttachment>? attachments)
        {
            if (attachments == null) return Enumerable.Empty<IAttachment>();

            return attachments
                .Where(a => !string.IsNullOrWhiteSpace(a.AttachmentByteArray))
                .Select(a => new AttachmentStub
                {
                    AttachmentByteArray = a.AttachmentByteArray,
                    AttachmentName = a.AttachmentName ?? string.Empty,
                    AttachmentImageType = a.AttachmentImageType,
                })
                .ToList();
        }
    }
}
