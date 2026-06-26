using HelpDeskNet8.Infrastructure;
using HelpDeskNet8.Interfaces.Shared;
using HelpDeskNet8.Interfaces.RFCs;
using System.Linq;
using HelpDeskNet8.Interfaces.Tickets;
using HelpDeskNet8.Interfaces.Users;
using HelpDeskNet8.Interfaces.Projects;

namespace HelpDeskNet8.Services
{
    // Server-side notification routing. The recipient rules and the SMTP send
    // live here, next to the data that resolves them -- the browser no longer
    // decides who gets emailed. First slice: task saves only; note and ticket
    // events will route through the same Notify() as they are migrated.
    public class NotificationService : INotificationService
    {
        // Shared notification inbox, used only as the sender address.
        private const string FromAddress = "govtech.helpdesk@govtech.co.uk";

        private readonly ITicketManager _ticketManager;
        private readonly IMiscManager _miscManager;
        private readonly IRFCManager _rfcManager;
        private readonly IMailPreviewSink _preview;
        private readonly IProjectManager _projectManager;
        private readonly IUserManager _userManager;

        public NotificationService(ITicketManager ticketManager, IMiscManager miscManager, IRFCManager rfcManager, IMailPreviewSink preview, IProjectManager projectManager, IUserManager userManager)
        {
            _ticketManager = ticketManager;
            _miscManager = miscManager;
            _rfcManager = rfcManager;
            _preview = preview;
            _projectManager = projectManager;
            _userManager = userManager;
        }

        public async Task Notify(int ticketId, NotificationType type, IUser user)
        {
            try
            {
                if (ticketId <= 0) return;

                ITicket ticket = await _ticketManager.GetTicketDetail(ticketId, user);
                if (ticket == null) return;

                // C2/C3: an event can notify several parties (e.g. assign ->
                // tech + client; message -> client + tech). Exclude the acting
                // user (the author) so a sender is never emailed their own
                // action. UserLogin is the user's email; UserEmail as a backup.
                string authorEmail = !string.IsNullOrWhiteSpace(user?.UserLogin)
                    ? user.UserLogin
                    : user?.UserEmail;

                // 2b-a: a ticket created on a project also notifies the project owner.
                string projectOwnerEmail = await ResolveProjectOwnerEmail(type, ticket, user);

                string[] recipients = ResolveRecipients(type, ticket)
                    .Append(projectOwnerEmail)
                    .Where(e => !string.IsNullOrWhiteSpace(e))
                    .Where(e => string.IsNullOrWhiteSpace(authorEmail)
                        || !string.Equals(e, authorEmail, System.StringComparison.OrdinalIgnoreCase))
                    .Distinct(System.StringComparer.OrdinalIgnoreCase)
                    .ToArray();
                if (recipients.Length == 0) return;

                string subject = BuildSubject(type, ticketId);
                string body = BuildBody(type, ticketId);

                if (_preview.Enabled)
                {
                    _preview.Add(PointLabel(type), recipients, subject);
                    return;
                }

                await _miscManager.SendMailMessage(FromAddress, recipients, subject, body);
            }
            catch
            {
                // A notification failure must never break the originating save.
            }
        }

        // RFC notifications. Internal-only: both reply and assign go to the
        // assigned tech + the originator. Recipients are identical for both
        // types; the type only selects the wording.
        public async Task NotifyRFC(int rfcId, NotificationType type)
        {
            try
            {
                if (rfcId <= 0) return;

                IRFC rfc = await _rfcManager.GetRFCDetail(rfcId);
                if (rfc == null) return;

                string[] recipients = new[] { rfc.AssignedTechEmail, rfc.OriginatorEmail }
                    .Where(e => !string.IsNullOrWhiteSpace(e))
                    .Distinct()
                    .ToArray();
                if (recipients.Length == 0) return;

                string subject = BuildSubject(type, rfcId);
                string body = BuildBody(type, rfcId);

                if (_preview.Enabled)
                {
                    _preview.Add(PointLabel(type), recipients, subject);
                    return;
                }

                await _miscManager.SendMailMessage(FromAddress, recipients, subject, body);
            }
            catch
            {
                // A notification failure must never break the originating save.
            }
        }

        // The recipient rules. One arm per NotificationType. Returns the full
        // set for the event; Notify() then drops blanks + the author + dupes.
        // 2b-a: resolve the project owner's email for a ticket created on a
        // project. Returns empty when it's not a creation, has no project, or
        // the owner can't be resolved. Notify's author filter drops the owner
        // if they are the acting user.
        private async Task<string> ResolveProjectOwnerEmail(NotificationType type, ITicket ticket, IUser user)
        {
            if (type != NotificationType.TicketCreated) return string.Empty;
            if (!ticket.ProjectID.HasValue || ticket.ProjectID.Value <= 0) return string.Empty;

            IProject? project = await _projectManager.GetProjectDetail(user, ticket.ProjectID.Value);
            if (project == null || project.OwnerID <= 0) return string.Empty;

            IUser? owner = await _userManager.GetUserDetail(project.OwnerID);
            if (owner == null) return string.Empty;

            return (string.IsNullOrWhiteSpace(owner.UserEmail) ? owner.UserLogin : owner.UserEmail) ?? string.Empty;
        }

        private static string[] ResolveRecipients(NotificationType type, ITicket ticket)
        {
            switch (type)
            {
                // A new ticket was created -> notify the helpdesk inbox (the
                // shared FromAddress), NOT the originator. HD35 B1/B3.
           case NotificationType.TicketCreated:
                    // 6a: an incident (request type 8) does not email on creation.
                    if (ticket.RequestID == 8) return System.Array.Empty<string>();
                    // 1b: a Contact Client ticket (type 12) is raised on behalf of
                    // a client -> email that client (the ticket originator) too.
                    if (ticket.RequestID == 12) return new[] { ticket.Email, FromAddress };
                    return new[] { FromAddress };

                // A task was saved -> the ticket's assigned tech is notified.
                case NotificationType.TaskSaved:
                    return new[] { ticket.AssignedTechEmail };

                // C3: a message/note was added -> notify BOTH the client
                // (originator) and the assigned tech. Notify() removes the
                // author, so the sender is never emailed their own message.
                case NotificationType.NoteResponded:
                    return new[] { ticket.Email, ticket.AssignedTechEmail };

                // A ticket reply -> same routing as a note reply (C3).
                case NotificationType.TicketResponded:
                    return new[] { ticket.Email, ticket.AssignedTechEmail };

                // C2: the assigned tech was changed -> notify the new tech AND
                // the client who raised the ticket.
                case NotificationType.TicketAssigned:
                    return new[] { ticket.AssignedTechEmail, ticket.Email };

                default:
                    return System.Array.Empty<string>();
            }
        }

        // Internal tickets are raised by internal users; their request type
        // is one of these. Mirrors the client's INTERNAL_REQUEST_TYPES list.
        // (Contact Client, type 12, is intentionally NOT internal.)
        private static readonly int[] InternalRequestTypes = { 4, 8, 10, 11, 14 };

        private static bool IsInternal(ITicket ticket)
        {
            return ticket.RequestID.HasValue
                && System.Array.IndexOf(InternalRequestTypes, ticket.RequestID.Value) >= 0;
        }

        // Friendly label for the dev mail-preview popup ("at each point").
        private static string PointLabel(NotificationType type)
        {
            return type switch
            {
                NotificationType.TicketCreated => "New ticket",
                NotificationType.TaskSaved => "Task saved",
                NotificationType.NoteResponded => "Reply added",
                NotificationType.TicketResponded => "Ticket reply saved",
                NotificationType.TicketAssigned => "Assigned tech changed",
                NotificationType.RFCResponded => "RFC updated",
                NotificationType.RFCAssigned => "RFC assigned",
                _ => "Notification",
            };
        }

        private static string BuildSubject(NotificationType type, int ticketId)
        {
            return type switch
            {
                NotificationType.TicketCreated => $"New Ticket {ticketId}",
                NotificationType.TaskSaved => $"Updated Task on Ticket {ticketId}",
                NotificationType.NoteResponded => $"Responded Ticket {ticketId}",
                NotificationType.TicketResponded => $"Responded Ticket {ticketId}",
                NotificationType.TicketAssigned => $"Assigned Ticket {ticketId}",
                NotificationType.RFCResponded => $"Responded RFC {ticketId}",
                NotificationType.RFCAssigned => $"Assigned RFC {ticketId}",
                _ => $"Notification - Ticket {ticketId}",
            };
        }

        // Mirrors the notification email the client used to build: a simple HTML
        // body with the message and a reminder to log in rather than follow links.
        private static string BuildBody(NotificationType type, int ticketId)
        {
            string message = type switch
            {
                NotificationType.TicketCreated =>
                    $"A new Ticket {ticketId} has been raised. Please review it in the helpdesk.",
                NotificationType.TaskSaved =>
                    $"A task on Ticket {ticketId} has been updated. It may require your attention, please review.",
                NotificationType.NoteResponded =>
                    $"Ticket {ticketId} has been responded to. It may require your attention, please review.",
                NotificationType.TicketResponded =>
                    $"Ticket {ticketId} has been responded to. It may require your attention, please review.",
                NotificationType.TicketAssigned =>
                    $"Ticket {ticketId} has been assigned to you. It may require your attention, please review.",
                NotificationType.RFCResponded =>
                    $"RFC {ticketId} has been updated. It may require your attention, please review.",
                NotificationType.RFCAssigned =>
                    $"RFC {ticketId} has been assigned to you. It may require your attention, please review.",
                _ => $"Ticket {ticketId} has an update.",
            };

            return
                "<div style=\"margin-bottom:30px;\">" +
                "<table style=\"border-radius:3px; width:800px; padding-left:20px; " +
                "background-color:#eaeaea; border:solid grey 1px;\">" +
                "<thead style=\"font-size:18px;\"><tr style=\"height:40px; color:white; " +
                "font-size:20px; background-color:#484848;\">" +
                "<td><b>Govtech Helpdesk - New Notification</b></td></tr></thead>" +
                "<tbody style=\"font-size:16px;\">" +
                "<tr><td><b>Notification : </b>" + message + "</td></tr>" +
                "<tr><td><b>Please log into Govtech Helpdesk to view the Ticket and respond.</b></td></tr>" +
                "<tr><td>Please do not reply to this email as it is only a notification and replies are not monitored.<br>" +
                "Never use a link in an email to access the helpdesk as a security measure. " +
                "Instead search for the website using your browser.</td></tr>" +
                "</tbody></table></div>";
        }
    }
}
