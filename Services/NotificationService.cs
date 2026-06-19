using HelpDeskNet8.Infrastructure;
using HelpDeskNet8.Interfaces.Shared;
using HelpDeskNet8.Interfaces.RFCs;
using System.Linq;
using HelpDeskNet8.Interfaces.Tickets;
using HelpDeskNet8.Interfaces.Users;

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

        public NotificationService(ITicketManager ticketManager, IMiscManager miscManager, IRFCManager rfcManager, IMailPreviewSink preview)
        {
            _ticketManager = ticketManager;
            _miscManager = miscManager;
            _rfcManager = rfcManager;
            _preview = preview;
        }

        public void Notify(int ticketId, NotificationType type, IUser user)
        {
            try
            {
                if (ticketId <= 0) return;

                ITicket ticket = _ticketManager.GetTicketDetail(ticketId, user);
                if (ticket == null) return;

                string recipient = ResolveRecipient(type, ticket);
                if (string.IsNullOrWhiteSpace(recipient)) return;

                string subject = BuildSubject(type, ticketId);
                string body = BuildBody(type, ticketId);

                if (_preview.Enabled)
                {
                    _preview.Add(PointLabel(type), new[] { recipient }, subject);
                    return;
                }

                _miscManager.SendMailMessage(FromAddress, new[] { recipient }, subject, body);
            }
            catch
            {
                // A notification failure must never break the originating save.
            }
        }

        // RFC notifications. Internal-only: both reply and assign go to the
        // assigned tech + the originator. Recipients are identical for both
        // types; the type only selects the wording.
        public void NotifyRFC(int rfcId, NotificationType type)
        {
            try
            {
                if (rfcId <= 0) return;

                IRFC rfc = _rfcManager.GetRFCDetail(rfcId);
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

                _miscManager.SendMailMessage(FromAddress, recipients, subject, body);
            }
            catch
            {
                // A notification failure must never break the originating save.
            }
        }

        // The recipient rules. One arm per NotificationType.
        private static string ResolveRecipient(NotificationType type, ITicket ticket)
        {
            switch (type)
            {
                // A task was saved -> the ticket's assigned tech is notified.
                case NotificationType.TaskSaved:
                    return ticket.AssignedTechEmail;

                // A note was added -> an internal ticket notifies the assigned
                // tech; a client ticket notifies the client (originator).
                case NotificationType.NoteResponded:
                    return IsInternal(ticket) ? ticket.AssignedTechEmail : ticket.Email;

                // A ticket reply -> same routing as a note reply.
                case NotificationType.TicketResponded:
                    return IsInternal(ticket) ? ticket.AssignedTechEmail : ticket.Email;

                // The assigned tech was changed -> notify the new tech.
                case NotificationType.TicketAssigned:
                    return ticket.AssignedTechEmail;

                default:
                    return null;
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
