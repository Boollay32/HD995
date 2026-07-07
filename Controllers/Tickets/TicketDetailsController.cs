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
        ITaskService taskService,
        IAttachmentManager attachmentManager,
        IHistory history,
        INotificationService notificationService,
        IUserManager userManager) : ControllerBase
    {
        private readonly ITicketManager _ticketManager = ticketManager;
        private readonly INoteManager _noteManager = noteManager;
        private readonly INoteService _noteService = noteService;
        private readonly ITaskManager _taskManager = taskManager;
        private readonly ITaskService _taskService = taskService;
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

            // Delegated to the shared TaskService (single source of truth for
            // attachment mapping, notification routing incl. the assignee-change
            // detection, and the refreshed ticket-scoped list return).
            var (ok, error, tasks) = await _taskService.SaveTask(user, request);
            if (!ok) return BadRequest(error);
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
    }
}
