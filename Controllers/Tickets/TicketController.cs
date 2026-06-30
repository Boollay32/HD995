using HelpDeskNet8.Infrastructure;
using HelpDeskNet8.Interfaces.Shared;
using HelpDeskNet8.Interfaces.Tickets;
using HelpDeskNet8.Interfaces.Users;
using HelpDeskNet8.Models.Shared;
using HelpDeskNet8.Models.Tickets;
using HelpDeskNet8.Requests;
using Microsoft.AspNetCore.Mvc;
using System.Data;
using HelpDeskNet8.Controllers.Shared;
using HelpDeskNet8.Controllers.Tasks;  
using HelpDeskNet8.Controllers.Tickets;  

namespace HelpDeskNet8.Controllers.Tickets
{

    [ApiController]
    [Route("api/[controller]/[action]")]
    public class TicketController(
        ITicketManager ticketM,
        IAuthenticator auth,
        IDropdowns dropDownProv,
        INotificationService notificationService) : ControllerBase
    {
        private readonly ITicketManager _ticketManager = ticketM;
        private readonly IDropdowns _dropDown = dropDownProv;
        private readonly INotificationService _notificationService = notificationService;

        // GetTicketDetail removed - the detail page calls
        // TicketDetailsController.GetTicketDetail (with id validation + NotFound).
        // This duplicate had no JS caller and skipped those checks.

        [HttpPost]
        public async Task<IActionResult> GetTickets([FromBody] GetTicketsRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();

            Filter filter = TicketFilterMapper.Map(request.Filters);
            var allTickets = await _ticketManager.GetTickets(user, filter, request.MyTicket, request.UTC);
            return Ok(allTickets);
        }

        [HttpPost]
        public async Task<IActionResult> GetIncidents([FromBody] GetTicketsRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();

            // Incidents are Govtech-only; non-Govtech callers get an empty set.
            if (user.AuthorityID != Constants.Authority.Govtech) return Ok(System.Array.Empty<object>());

            Filter filter = TicketFilterMapper.Map(request.Filters);
            var incidents = await _ticketManager.GetIncidents(user, filter, request.MyTicket, request.UTC);
            return Ok(incidents);
        }

        [HttpPost]
        public async Task<IActionResult> SaveTicket([FromBody] SaveTicketRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();

            ITicket ticket = TicketMapper.Map(request.ObjectInfo);
            if (ticket == null) return BadRequest("Invalid ticket data.");

            // Clients may not edit ticket data after creation -- the internal team must
            // keep working off the information the client submitted at the start. The only
            // change a client may make to an existing ticket is resolving it (a status
            // change). Verify ownership, then discard every client-supplied field except
            // Status; the update proc's ISNULL(@param, existing) preserves all stored data.
            if (ticket.TicketID != null
                && await auth.CheckAdmin(user) == Constants.AdminLevel.Authority)
            {
                var existing = await _ticketManager.GetTicketDetail(ticket.TicketID.Value, user);
                if (existing == null || existing.UserAuthorityID != user.AuthorityID)
                    return NotFound();
                ticket = new Ticket { TicketID = ticket.TicketID, Status = ticket.Status };
            }

            // Fix: redacted value restored
            if (request.ContactClientAuthorityId.HasValue && request.ContactClientUserId.HasValue)
            {
                ticket.AssignedTechID = user.UserID;
                user.UserID = request.ContactClientUserId.Value;
                user.AuthorityID = request.ContactClientAuthorityId.Value;
            }

            // On update, capture the current assigned tech so we can tell a
            // re-assignment ('Assigned') from a plain reply ('Responded').
            int? oldAssignedTechId = null;
            string oldStatus = null;
            string oldTechEmail = null;
            if (ticket.TicketID != null)
            {
                var before = await _ticketManager.GetTicketDetail(ticket.TicketID.Value, user);
                oldAssignedTechId = before?.AssignedTechID;
                oldStatus = before?.Status;
                oldTechEmail = before?.AssignedTechEmail;
            }

            // Fix: SaveResult — strongly typed — replaces List<object> index access
            SaveResult result = ticket.TicketID != null
                ? await _ticketManager.SaveTicket(ticket.GetChanges(), user, request.UTC, request.FalseReply, request.EmailSent, visibleToClient: 1)
                : await _ticketManager.SaveTicket(ticket, user, request.UTC, request.FalseReply, request.EmailSent);

            if (!result.IsSuccess)
                return BadRequest(result.Error);

            // Notify on update only: Assigned if the tech changed, else Responded.
            if (ticket.TicketID != null)
            {
                var saved = await _ticketManager.GetTicketDetail(ticket.TicketID.Value, user);
                if (saved != null)
                {
                    bool techChanged = oldAssignedTechId != saved.AssignedTechID;
                    bool statusChanged = !string.Equals(oldStatus ?? "", saved.Status ?? "", System.StringComparison.OrdinalIgnoreCase);

                    // A reassignment and a status change are distinct events: if a
                    // single save does both, record (notify) both rather than letting
                    // the reassign mask the status move. A plain reply fires only when
                    // neither moved.
                    if (techChanged)
                        await _notificationService.Notify(ticket.TicketID.Value, NotificationType.TicketAssigned, user,
                            new NotificationContext { OldTechEmail = oldTechEmail });
                    if (statusChanged)
                        await _notificationService.Notify(ticket.TicketID.Value, NotificationType.TicketStatusChanged, user,
                            new NotificationContext { OldStatus = oldStatus, NewStatus = saved.Status, TechAlsoChanged = techChanged });
                    if (!techChanged && !statusChanged)
                        await _notificationService.Notify(ticket.TicketID.Value, NotificationType.TicketResponded, user);
                }
            }

            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> ChangeCustomFields([FromBody] ChangeCustomFieldsRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();

            DataTable customFields = await _dropDown.GetCustomFields(user, request.RequestId);

            // ToListOfDictionaries keys are the DataTable column names (PascalCase), and
            // System.Text.Json's camelCase policy does not rename dictionary keys -- so the
            // client read customFilterItem/customFilterObjectType/etc. as undefined and
            // rendered blank fields. camelCase the keys to match the JS convention.
            var result = customFields.ToListOfDictionaries()
                .Select(row => row.ToDictionary(
                    kv => kv.Key.Length > 0 ? char.ToLowerInvariant(kv.Key[0]) + kv.Key.Substring(1) : kv.Key,
                    kv => kv.Value));
            return Ok(result);
        }
    }
}
