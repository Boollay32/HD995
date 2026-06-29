using HelpDeskNet8.Infrastructure;
using HelpDeskNet8.Interfaces.Shared;
using HelpDeskNet8.Interfaces.RFCs;
using System.Linq;
using HelpDeskNet8.Interfaces.Tickets;
using HelpDeskNet8.Interfaces.Users;
using HelpDeskNet8.Interfaces.Projects;
using HelpDeskNet8.Models.Shared;

namespace HelpDeskNet8.Services
{
    // Server-side notification routing. Recipient rules + SMTP send live here.
    // HD43: the project owner only hears about status changes (ticket + task);
    // the shared inbox is used ONLY when a new client ticket is raised with no
    // tech yet; the client is never emailed about tasks; every body carries the
    // specific change (who / what / old -> new), still metadata only.
    public class NotificationService : INotificationService
    {
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

        public async Task Notify(int ticketId, NotificationType type, IUser user, NotificationContext? context = null)
        {
            try
            {
                if (ticketId <= 0) return;

                ITicket ticket = await _ticketManager.GetTicketDetail(ticketId, user);
                if (ticket == null) return;

                // Exclude the acting user so a sender is never emailed their own
                // action. UserLogin is the user's email; UserEmail as a backup.
                string authorEmail = !string.IsNullOrWhiteSpace(user?.UserLogin)
                    ? user.UserLogin
                    : user?.UserEmail;

                var people = await ResolveTicketRecipients(type, ticket, user, context);

                string[] recipients = people
                    .Where(e => !string.IsNullOrWhiteSpace(e))
                    .Where(e => string.IsNullOrWhiteSpace(authorEmail)
                        || !string.Equals(e, authorEmail, System.StringComparison.OrdinalIgnoreCase))
                    .Distinct(System.StringComparer.OrdinalIgnoreCase)
                    .ToArray();
                if (recipients.Length == 0) return;

                string subject = BuildSubject(type, ticketId);
                string body = BuildBody(BuildTicketMessage(type, ticketId, ticket, context, user));

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
        // assigned tech + the originator. The type only selects the wording.
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
                string body = BuildBody(BuildRfcMessage(type, rfcId));

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

        // ----------------------------  Recipients  ---------------------------- //

        // Build the recipient set for a ticket/task event. Notify() then drops
        // blanks, the acting user, and duplicates.
        private async Task<System.Collections.Generic.List<string>> ResolveTicketRecipients(
            NotificationType type, ITicket ticket, IUser user, NotificationContext? context)
        {
            var people = new System.Collections.Generic.List<string>();

            string tech = ticket.AssignedTechEmail;
            string originator = ticket.Email;
            bool clientFacing = !IsInternal(ticket);
            bool hasTech = !string.IsNullOrWhiteSpace(tech);

            switch (type)
            {
                case NotificationType.TicketCreated:
                    // New work: the assigned tech + the project owner (oversight).
                    // The shared inbox is a triage fallback ONLY for a client-raised
                    // ticket with no tech yet. The creator is the actor (dropped).
                    people.Add(tech);
                    people.Add(await ResolveProjectOwnerEmail(ticket, user));
                    if (clientFacing && !hasTech) people.Add(FromAddress);
                    break;

                case NotificationType.NoteResponded:
                    // A reply: the tech always; the originator only when the note is
                    // client-visible (internal notes never reach the client). No inbox.
                    people.Add(tech);
                    if (context?.NoteVisibleToClient ?? true) people.Add(originator);
                    break;

                case NotificationType.TicketResponded:
                    // A plain ticket reply: tech + originator. No inbox, no owner.
                    people.Add(tech);
                    people.Add(originator);
                    break;

                case NotificationType.TicketAssigned:
                    // Re-assignment: only the (new) assigned tech. Not a status move,
                    // so the project owner is not notified.
                    people.Add(tech);
                    break;

                case NotificationType.TicketStatusChanged:
                    // Status movement: tech + originator (the client, on a client
                    // ticket) + the project owner for oversight.
                    people.Add(tech);
                    people.Add(originator);
                    people.Add(await ResolveProjectOwnerEmail(ticket, user));
                    break;

                case NotificationType.TaskCreated:
                    // Ticket owner (the originator -- suppressed on a client ticket so
                    // the client never hears about tasks) + ticket's tech + the task's
                    // assignee (best-effort name match).
                    if (!clientFacing) people.Add(originator);
                    people.Add(tech);
                    people.Add(await ResolveAssigneeEmail(context?.TaskAssigneeName));
                    break;

                case NotificationType.TaskUpdated:
                    // Only the ticket's assigned tech (dropped if they are the actor).
                    people.Add(tech);
                    break;

                case NotificationType.TaskStatusChanged:
                    // Ticket owner (suppressed on a client ticket) + ticket's tech +
                    // the project owner.
                    if (!clientFacing) people.Add(originator);
                    people.Add(tech);
                    people.Add(await ResolveProjectOwnerEmail(ticket, user));
                    break;
            }

            return people;
        }

        // Resolve the project owner's email for a ticket that sits on a project.
        // Empty when there is no project or the owner can't be resolved.
        private async Task<string> ResolveProjectOwnerEmail(ITicket ticket, IUser user)
        {
            if (!ticket.ProjectID.HasValue || ticket.ProjectID.Value <= 0) return string.Empty;

            IProject? project = await _projectManager.GetProjectDetail(user, ticket.ProjectID.Value);
            if (project == null || project.OwnerID <= 0) return string.Empty;

            IUser? owner = await _userManager.GetUserDetail(project.OwnerID);
            if (owner == null) return string.Empty;

            return (string.IsNullOrWhiteSpace(owner.UserEmail) ? owner.UserLogin : owner.UserEmail) ?? string.Empty;
        }

        // Best-effort: a task stores only the assignee's display NAME, so match it
        // against the user list and resolve their email. Fragile by nature
        // (duplicate / mismatched names) -- returns empty when there is no clean
        // single match, and never throws into the caller.
        private async Task<string> ResolveAssigneeEmail(string? assigneeName)
        {
            if (string.IsNullOrWhiteSpace(assigneeName)) return string.Empty;
            try
            {
                var users = await _userManager.GetUsers(new Filter());
                if (users == null) return string.Empty;

                var match = users.FirstOrDefault(u =>
                    !string.IsNullOrWhiteSpace(u.UserName)
                    && string.Equals(u.UserName.Trim(), assigneeName.Trim(), System.StringComparison.OrdinalIgnoreCase));
                if (match == null || !match.UserID.HasValue) return string.Empty;

                IUser? person = await _userManager.GetUserDetail(match.UserID.Value);
                if (person == null) return string.Empty;
                return (string.IsNullOrWhiteSpace(person.UserEmail) ? person.UserLogin : person.UserEmail) ?? string.Empty;
            }
            catch
            {
                return string.Empty;
            }
        }

        private static readonly int[] InternalRequestTypes = { 4, 8, 10, 11, 14 };

        private static bool IsInternal(ITicket ticket)
        {
            return ticket.RequestID.HasValue
                && System.Array.IndexOf(InternalRequestTypes, ticket.RequestID.Value) >= 0;
        }

        // ----------------------------  Wording  ---------------------------- //

        private static string PointLabel(NotificationType type)
        {
            return type switch
            {
                NotificationType.TicketCreated => "New ticket",
                NotificationType.NoteResponded => "Reply added",
                NotificationType.TicketResponded => "Ticket reply saved",
                NotificationType.TicketAssigned => "Assigned tech changed",
                NotificationType.TicketStatusChanged => "Ticket status changed",
                NotificationType.TaskCreated => "Task created",
                NotificationType.TaskUpdated => "Task updated",
                NotificationType.TaskStatusChanged => "Task status changed",
                NotificationType.RFCResponded => "RFC updated",
                NotificationType.RFCAssigned => "RFC assigned",
                _ => "Notification",
            };
        }

        private static string BuildSubject(NotificationType type, int id)
        {
            return type switch
            {
                NotificationType.TicketCreated => $"New Ticket {id}",
                NotificationType.NoteResponded => $"Update on Ticket {id}",
                NotificationType.TicketResponded => $"Update on Ticket {id}",
                NotificationType.TicketAssigned => $"Ticket {id} Assigned",
                NotificationType.TicketStatusChanged => $"Ticket {id} Status Changed",
                NotificationType.TaskCreated => $"New Task on Ticket {id}",
                NotificationType.TaskUpdated => $"Task Updated on Ticket {id}",
                NotificationType.TaskStatusChanged => $"Task Status Changed on Ticket {id}",
                NotificationType.RFCResponded => $"Responded RFC {id}",
                NotificationType.RFCAssigned => $"Assigned RFC {id}",
                _ => $"Notification - Ticket {id}",
            };
        }

        // The specific, dynamic line describing what happened. Metadata only.
        private static string BuildTicketMessage(NotificationType type, int id, ITicket ticket, NotificationContext? ctx, IUser user)
        {
            string actor = string.IsNullOrWhiteSpace(user?.UserName) ? "a user" : user.UserName;
            string subject = string.IsNullOrWhiteSpace(ticket?.Subject) ? "" : $" '{ticket.Subject}'";
            string priority = string.IsNullOrWhiteSpace(ticket?.Priority) ? "" : ticket.Priority;
            string taskTitle = string.IsNullOrWhiteSpace(ctx?.TaskTitle) ? "a task" : $"'{ctx.TaskTitle}'";
            string oldS = string.IsNullOrWhiteSpace(ctx?.OldStatus) ? "(unknown)" : ctx.OldStatus;
            string newS = string.IsNullOrWhiteSpace(ctx?.NewStatus) ? "(unknown)" : ctx.NewStatus;

            switch (type)
            {
                case NotificationType.TicketCreated:
                    return $"A new ticket #{id}{subject} has been raised"
                        + (string.IsNullOrEmpty(priority) ? "" : $" with priority {priority}") + ".";

                case NotificationType.NoteResponded:
                    return $"{actor} added a reply to ticket #{id}{subject}.";

                case NotificationType.TicketResponded:
                    return $"{actor} updated ticket #{id}{subject}.";

                case NotificationType.TicketAssigned:
                    return $"Ticket #{id}{subject} has been assigned"
                        + (string.IsNullOrWhiteSpace(ticket?.AssignedTechEmail) ? "" : $" to {ticket.AssignedTechEmail}")
                        + $" by {actor}.";

                case NotificationType.TicketStatusChanged:
                    return $"Ticket #{id}{subject} status changed from {oldS} to {newS} by {actor}.";

                case NotificationType.TaskCreated:
                    return $"A new task {taskTitle} was created on ticket #{id}{subject} by {actor}.";

                case NotificationType.TaskUpdated:
                    return $"The task {taskTitle} on ticket #{id}{subject} was updated by {actor}.";

                case NotificationType.TaskStatusChanged:
                    return $"The task {taskTitle} on ticket #{id}{subject} is now '{TaskStatusLabel(ctx?.NewTaskStatus)}'"
                        + $" (was '{TaskStatusLabel(ctx?.OldTaskStatus)}'), changed by {actor}.";

                default:
                    return $"Ticket #{id} has an update.";
            }
        }

        private static string BuildRfcMessage(NotificationType type, int id)
        {
            return type switch
            {
                NotificationType.RFCResponded => $"RFC {id} has been updated. It may require your attention, please review.",
                NotificationType.RFCAssigned => $"RFC {id} has been assigned to you. It may require your attention, please review.",
                _ => $"RFC {id} has an update.",
            };
        }

        private static string TaskStatusLabel(int? status)
        {
            return status switch
            {
                1 => "New",
                2 => "In Progress",
                3 => "Complete",
                4 => "Withdrawn",
                5 => "Draft",
                _ => "Unknown",
            };
        }

        // Wrap a notification line in the Govtech Helpdesk email shell.
        private static string BuildBody(string message)
        {
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
