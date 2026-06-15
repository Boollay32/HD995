using HelpDeskNet8.Infrastructure;
using HelpDeskNet8.Interfaces.Shared;
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

        public NotificationService(ITicketManager ticketManager, IMiscManager miscManager)
        {
            _ticketManager = ticketManager;
            _miscManager = miscManager;
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

                _miscManager.SendMailMessage(FromAddress, new[] { recipient }, subject, body);
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

                default:
                    return null;
            }
        }

        private static string BuildSubject(NotificationType type, int ticketId)
        {
            return type switch
            {
                NotificationType.TaskSaved => $"Updated Task on Ticket {ticketId}",
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
