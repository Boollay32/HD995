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
        INoteService noteService,
        ITaskManager taskManager,
        IAttachmentManager attachmentManager,
        IHistory history,
        INotificationService notificationService,
        IUserManager userManager) : ControllerBase
    {
        private readonly ITicketManager _ticketManager = ticketManager;
        private readonly INoteManager _noteManager = noteManager;
        private readonly INoteService _noteService = noteService;
        private readonly ITaskManager _taskManager = taskManager;
        private readonly IUserManager _userManager = userManager;
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

            // Delegated to the shared NoteService (single source of truth).
            var notes = await _noteService.GetNotes(user, request.TicketId);
            return Ok(notes);
        }

        [HttpPost]
        public async Task<IActionResult> SaveNote([FromBody] SaveNoteRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();

            // Delegated to the shared NoteService (single source of truth for
            // ownership check, attachment mapping, notification routing and the
            // refreshed-list return shape).
            var (ok, error, notes) = await _noteService.SaveNote(user, request);
            if (!ok) return BadRequest(error);
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
            string oldTaskAssignee = null;
            if (!isNewTask)
            {
                var beforeTask = (await _taskManager.GetTaskDetail(user, task.TaskID.Value)).FirstOrDefault();
                oldTaskStatus = beforeTask?.Status;
                oldTaskAssignee = beforeTask?.AssignedTech;
            }

            var result = await _taskManager.SaveTask(
                task,
                attachments,
                user.UserID,
                UTC: 0);

            if (!result.IsSuccess)
                return BadRequest(result.Error);

            // The task form sends the assignee's user id; re-read the saved task
            // to get the display name so the wording shows the name (not the id),
            // the assignee resolves to a recipient, and the assignee-changed check
            // below compares name-to-name (not name-to-id, always "changed").
            // The form sends the assignee's user id as task.AssignedTech; capture
            // it now, before the re-read below overwrites the same variable name
            // with the display name for wording. ResolveAssigneeEmailById resolves
            // the recipient from this id directly -- no cross-proc name matching.
            int? newAssigneeId = int.TryParse(task.AssignedTech, out int parsedAssigneeId) ? parsedAssigneeId : (int?)null;

            string newAssigneeName = task.AssignedTech;
            // usp_Helpdesk_ManageTask returns the id only from its INSERT
            // branch -- updates return nothing -- so fall back to the posted
            // TaskID. Without this, edits skipped the refetch, an untouched
            // assignee (the keep option omits the field) stayed null, and
            // null-vs-old-name read as "assignee changed": a spurious
            // assignment email on ordinary edits. Also feeds ctx.TaskID so
            // update notifications deep-link correctly.
            int? savedTaskId = result.ObjectID ?? task.TaskID;
            if (savedTaskId.HasValue && savedTaskId.Value != 0)
            {
                var savedTask = (await _taskManager.GetTaskDetail(user, savedTaskId.Value)).FirstOrDefault();
                if (savedTask != null) newAssigneeName = savedTask.AssignedTech;
            }
            if (string.IsNullOrWhiteSpace(task.AssignedTech) && string.IsNullOrWhiteSpace(newAssigneeName))
            {
                newAssigneeName = oldTaskAssignee; // untouched assignee: unchanged
            }
            // Creates do not always return the new task id, so the refetch
            // above can miss -- and the raw posted ID then leaked into the
            // notification wording ("assigned ... to 1000935"). People are
            // not robots: if the "name" still parses as a number and we have
            // the id, resolve the display name from the user record.
            if (newAssigneeId.HasValue && int.TryParse(newAssigneeName, out _))
            {
                var assigneeUser = await _userManager.GetUserDetail(newAssigneeId.Value);
                if (!string.IsNullOrWhiteSpace(assigneeUser?.UserName))
                    newAssigneeName = assigneeUser.UserName;
            }

            // HD44: route the task event(s). Create, status change and assignee
            // change are distinct events (mirroring tickets): a single save that
            // changes more than one fires each. A new task with an assignee fires
            // both Created and Assigned. The context carries the title, the new and
            // previous assignee, and the old->new status for the wording.
            var taskCtx = new NotificationContext
            {
                TaskTitle = task.Title,
                TaskID = savedTaskId,
                TaskAssigneeID = newAssigneeId,
                TaskAssigneeName = newAssigneeName,
                OldTaskAssigneeName = oldTaskAssignee,
                OldTaskStatus = oldTaskStatus,
                NewTaskStatus = task.Status,
            };
            int taskTicketId = task.TicketID ?? 0;

            if (isNewTask)
            {
                await _notificationService.Notify(taskTicketId, NotificationType.TaskCreated, user, taskCtx);
                if (!string.IsNullOrWhiteSpace(newAssigneeName))
                    await _notificationService.Notify(taskTicketId, NotificationType.TaskAssigned, user, taskCtx);
            }
            else
            {
                bool taskAssigneeChanged = !string.Equals(oldTaskAssignee ?? "", newAssigneeName ?? "", System.StringComparison.OrdinalIgnoreCase);
                bool taskStatusChanged = oldTaskStatus != task.Status;
                if (taskAssigneeChanged)
                    await _notificationService.Notify(taskTicketId, NotificationType.TaskAssigned, user, taskCtx);
                if (taskStatusChanged)
                    await _notificationService.Notify(taskTicketId, NotificationType.TaskStatusChanged, user, taskCtx);
                if (!taskAssigneeChanged && !taskStatusChanged)
                    await _notificationService.Notify(taskTicketId, NotificationType.TaskUpdated, user, taskCtx);
            }

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
