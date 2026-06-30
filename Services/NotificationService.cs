using HelpDeskNet8.Infrastructure;
using HelpDeskNet8.Interfaces.Shared;
using HelpDeskNet8.Interfaces.RFCs;
using System.Linq;
using System.Collections.Generic;
using HelpDeskNet8.Interfaces.Tickets;
using HelpDeskNet8.Interfaces.Users;
using HelpDeskNet8.Interfaces.Projects;
using HelpDeskNet8.Models.Shared;

namespace HelpDeskNet8.Services
{
    // Server-side notification routing. Recipient rules + SMTP send live here.
    // HD44: recipients are keyed on the EVENT and on WHO made the change -- an
    // internal Govtech user vs a client-authority user (Constants.Authority.Govtech).
    // A "client ticket" is one owned by a client authority (UserAuthorityID). The
    // acting user is always stripped from the recipients (never self-notified).
    // Every body is built dynamically -- a headline describing the action plus a
    // metadata-only facts block; a status move to a terminal status switches the
    // headline to a closure line whose verb matches the status used.
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

                string actorEmail = !string.IsNullOrWhiteSpace(user?.UserLogin)
                    ? user.UserLogin
                    : user?.UserEmail;

                var people = await ResolveTicketRecipients(type, ticket, user, context);

                string[] recipients = StripActorAndDedupe(people, actorEmail);
                if (recipients.Length == 0) return;

                var (subject, headline, facts) = BuildTicketEmail(type, ticketId, ticket, context, user);
                string body = BuildBody(headline, facts);

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

        public async Task NotifyRFC(int rfcId, NotificationType type, IUser user, NotificationContext? context = null)
        {
            try
            {
                if (rfcId <= 0) return;

                IRFC rfc = await _rfcManager.GetRFCDetail(rfcId);
                if (rfc == null) return;

                string actorEmail = !string.IsNullOrWhiteSpace(user?.UserLogin)
                    ? user.UserLogin
                    : user?.UserEmail;

                // RFCs are internal-only. Assigned (creation) -> the new tech only;
                // an update or status change -> the RFC owner + the tech.
                var people = new List<string>();
                switch (type)
                {
                    case NotificationType.RFCAssigned:
                        people.Add(rfc.AssignedTechEmail);
                        break;
                    case NotificationType.RFCResponded:
                    case NotificationType.RFCStatusChanged:
                        people.Add(rfc.OriginatorEmail);
                        people.Add(rfc.AssignedTechEmail);
                        break;
                }

                string[] recipients = StripActorAndDedupe(people, actorEmail);
                if (recipients.Length == 0) return;

                var (subject, headline, facts) = BuildRfcEmail(type, rfc, context, user);
                string body = BuildBody(headline, facts);

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

        // Drop blanks, the acting user (never self-notify -- the global caveat),
        // and duplicates, case-insensitively.
        private static string[] StripActorAndDedupe(IEnumerable<string> people, string actorEmail)
        {
            return people
                .Where(e => !string.IsNullOrWhiteSpace(e))
                .Where(e => string.IsNullOrWhiteSpace(actorEmail)
                    || !string.Equals(e, actorEmail, System.StringComparison.OrdinalIgnoreCase))
                .Distinct(System.StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }

        // Build the recipient set for a ticket/task event, keyed on the event and
        // on whether the actor is an internal (Govtech) user or a client.
        private async Task<List<string>> ResolveTicketRecipients(
            NotificationType type, ITicket ticket, IUser user, NotificationContext? context)
        {
            var people = new List<string>();

            string tech = ticket.AssignedTechEmail;     // the ticket's assigned tech
            string owner = ticket.Email;                // the ticket originator / owner
            bool actorInternal = ActorIsInternal(user);
            bool clientTicket = IsClientTicket(ticket);

            switch (type)
            {
                case NotificationType.TicketCreated:
                    if (!actorInternal)
                    {
                        // A client raised the ticket -> the shared triage inbox.
                        people.Add(FromAddress);
                    }
                    else if (clientTicket)
                    {
                        // An internal user raised it on behalf of a client -> only
                        // the client (the ticket owner).
                        people.Add(owner);
                    }
                    else
                    {
                        // An internal ticket -> the project owner + the assigned tech.
                        people.Add(await ResolveProjectOwnerEmail(ticket, user));
                        people.Add(tech);
                    }
                    break;

                case NotificationType.TicketResponded:
                    // "Updated" -- internal-only (clients can't update a ticket).
                    people.Add(tech);
                    break;

                case NotificationType.TicketStatusChanged:
                    if (!actorInternal)
                    {
                        // A client changed the status -> the assigned tech.
                        people.Add(tech);
                    }
                    else
                    {
                        // Internal -> the project owner + ticket owner + assigned tech.
                        people.Add(await ResolveProjectOwnerEmail(ticket, user));
                        people.Add(owner);
                        people.Add(tech);
                    }
                    break;

                case NotificationType.TicketAssigned:
                    // Internal-only -> the newly assigned tech.
                    people.Add(tech);
                    break;

                case NotificationType.NoteResponded:
                    // A note was created. Client -> the assigned tech; internal ->
                    // the ticket owner + the assigned tech.
                    if (!actorInternal)
                    {
                        people.Add(tech);
                    }
                    else
                    {
                        people.Add(owner);
                        people.Add(tech);
                    }
                    break;

                case NotificationType.TaskCreated:
                case NotificationType.TaskStatusChanged:
                    // HD44: the task's own assigned tech (always, best-effort name
                    // match), the ticket owner (the actor-strip drops them when they
                    // raised it), and the project owner.
                    people.Add(await ResolveAssigneeEmail(context?.TaskAssigneeName));
                    people.Add(owner);
                    people.Add(await ResolveProjectOwnerEmail(ticket, user));
                    break;

                case NotificationType.TaskUpdated:
                    // HD44: the task's own assigned tech (always) + the ticket owner
                    // (dropped if they are the actor).
                    people.Add(await ResolveAssigneeEmail(context?.TaskAssigneeName));
                    people.Add(owner);
                    break;

                case NotificationType.TaskAssigned:
                    // -> the newly assigned task assignee (best-effort name match).
                    people.Add(await ResolveAssigneeEmail(context?.TaskAssigneeName));
                    break;
            }

            return people;
        }

        // The acting user is internal iff they belong to the Govtech authority.
        private static bool ActorIsInternal(IUser user)
        {
            return user?.AuthorityID == Constants.Authority.Govtech;
        }

        // A ticket is a "client ticket" when it is owned by a client authority
        // (anything other than Govtech), e.g. raised via the contact-client flow.
        private static bool IsClientTicket(ITicket ticket)
        {
            return ticket.UserAuthorityID.HasValue
                && ticket.UserAuthorityID.Value != Constants.Authority.Govtech;
        }

        // Resolve the project owner's email for a ticket that sits on a project.
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

        // ----------------------------  Wording  ---------------------------- //

        private static string PointLabel(NotificationType type)
        {
            return type switch
            {
                NotificationType.TicketCreated => "New ticket",
                NotificationType.NoteResponded => "Note added",
                NotificationType.TicketResponded => "Ticket updated",
                NotificationType.TicketAssigned => "Ticket assigned",
                NotificationType.TicketStatusChanged => "Ticket status changed",
                NotificationType.TaskCreated => "Task created",
                NotificationType.TaskUpdated => "Task updated",
                NotificationType.TaskStatusChanged => "Task status changed",
                NotificationType.TaskAssigned => "Task assigned",
                NotificationType.RFCResponded => "RFC updated",
                NotificationType.RFCAssigned => "RFC assigned",
                NotificationType.RFCStatusChanged => "RFC status changed",
                _ => "Notification",
            };
        }

        // Build (subject, headline, facts) for a ticket/task event. The facts are
        // metadata only -- ids, titles, status transitions; no message content.
        private static (string subject, string headline, List<string> facts) BuildTicketEmail(
            NotificationType type, int id, ITicket ticket, NotificationContext? ctx, IUser user)
        {
            string actor = string.IsNullOrWhiteSpace(user?.UserName) ? "A user" : user.UserName;
            string title = string.IsNullOrWhiteSpace(ticket?.Subject) ? "(no subject)" : ticket.Subject;
            string priority = string.IsNullOrWhiteSpace(ticket?.Priority) ? "\u2014" : ticket.Priority;
            string status = string.IsNullOrWhiteSpace(ticket?.Status) ? "\u2014" : ticket.Status;
            string tech = string.IsNullOrWhiteSpace(ticket?.AssignedTechEmail) ? "Unassigned" : ticket.AssignedTechEmail;
            string oldS = string.IsNullOrWhiteSpace(ctx?.OldStatus) ? "(unknown)" : ctx.OldStatus;
            string newS = string.IsNullOrWhiteSpace(ctx?.NewStatus) ? status : ctx.NewStatus;
            string tt = string.IsNullOrWhiteSpace(ctx?.TaskTitle) ? "a task" : ctx.TaskTitle;
            string ticketLine = $"Ticket #{id}: {title}";

            switch (type)
            {
                case NotificationType.TicketCreated:
                    return ($"New ticket #{id}: {title}",
                        $"A new ticket has been raised by {actor}.",
                        new List<string> { ticketLine, $"Priority: {priority} \u00b7 Status: {status}", $"Assigned to: {tech}" });

                case NotificationType.TicketResponded:
                    return ($"Ticket #{id} updated: {title}",
                        $"{actor} updated ticket #{id}.",
                        new List<string> { ticketLine, $"Priority: {priority} \u00b7 Status: {status}" });

                case NotificationType.NoteResponded:
                    return ($"New reply on ticket #{id}",
                        $"{actor} added a note to ticket #{id}.",
                        new List<string> { ticketLine });

                case NotificationType.TicketAssigned:
                {
                    string headline = !string.IsNullOrWhiteSpace(ctx?.OldTechEmail)
                        ? $"{actor} reassigned ticket #{id} from {ctx.OldTechEmail} to {tech}."
                        : $"{actor} assigned ticket #{id} to {tech}.";
                    return ($"Ticket #{id} assigned",
                        headline,
                        new List<string> { ticketLine, $"Priority: {priority} \u00b7 Status: {status}" });
                }

                case NotificationType.TicketStatusChanged:
                {
                    string headline; string subject;
                    if (IsClosingStatus(newS))
                    {
                        headline = $"{actor} has {ClosureVerb(newS)} ticket #{id}.";
                        subject = $"Ticket #{id} {ClosureVerb(newS)}";
                    }
                    else
                    {
                        headline = $"{actor} changed the status of ticket #{id}.";
                        subject = $"Ticket #{id} is now {newS}";
                    }
                    return (subject, headline,
                        new List<string> { ticketLine, $"Status: {oldS} \u2192 {newS}", $"Assigned to: {tech}" });
                }

                case NotificationType.TaskCreated:
                {
                    string headline = !string.IsNullOrWhiteSpace(ctx?.TaskAssigneeName)
                        ? $"{actor} created the task \"{tt}\" on ticket #{id} and assigned it to {ctx.TaskAssigneeName}."
                        : $"{actor} created the task \"{tt}\" on ticket #{id}.";
                    return ($"New task on ticket #{id}",
                        headline,
                        new List<string> { $"Task: {tt} \u00b7 Status: {TaskStatusLabel(ctx?.NewTaskStatus)}", ticketLine });
                }

                case NotificationType.TaskUpdated:
                    return ($"Task updated on ticket #{id}",
                        $"{actor} updated the task \"{tt}\" on ticket #{id}.",
                        new List<string> { $"Task: {tt} \u00b7 Status: {TaskStatusLabel(ctx?.NewTaskStatus)}", ticketLine });

                case NotificationType.TaskStatusChanged:
                {
                    string oldL = TaskStatusLabel(ctx?.OldTaskStatus);
                    string newL = TaskStatusLabel(ctx?.NewTaskStatus);
                    string headline; string subject;
                    if (IsClosingStatus(newL))
                    {
                        headline = $"{actor} has {ClosureVerb(newL)} the task \"{tt}\" on ticket #{id}.";
                        subject = $"Task {ClosureVerb(newL)} on ticket #{id}";
                    }
                    else
                    {
                        headline = $"{actor} changed the status of the task \"{tt}\" on ticket #{id}.";
                        subject = $"Task status changed on ticket #{id}";
                    }
                    return (subject, headline,
                        new List<string> { $"Task: {tt}", $"Status: {oldL} \u2192 {newL}", ticketLine });
                }

                case NotificationType.TaskAssigned:
                {
                    string assignee = string.IsNullOrWhiteSpace(ctx?.TaskAssigneeName) ? "(unassigned)" : ctx.TaskAssigneeName;
                    string headline = !string.IsNullOrWhiteSpace(ctx?.OldTaskAssigneeName)
                        ? $"{actor} reassigned the task \"{tt}\" from {ctx.OldTaskAssigneeName} to {assignee}."
                        : $"{actor} assigned the task \"{tt}\" on ticket #{id} to {assignee}.";
                    return ($"Task assigned on ticket #{id}",
                        headline,
                        new List<string> { $"Task: {tt} \u00b7 Status: {TaskStatusLabel(ctx?.NewTaskStatus)}", ticketLine });
                }

                default:
                    return ($"Notification \u2014 ticket #{id}", $"Ticket #{id} has an update.", new List<string> { ticketLine });
            }
        }

        private static (string subject, string headline, List<string> facts) BuildRfcEmail(
            NotificationType type, IRFC rfc, NotificationContext? ctx, IUser user)
        {
            int id = rfc?.ChangeRequestID ?? 0;
            string actor = string.IsNullOrWhiteSpace(user?.UserName) ? "A user" : user.UserName;
            string title = string.IsNullOrWhiteSpace(rfc?.Title) ? "(no title)" : rfc.Title;
            string status = string.IsNullOrWhiteSpace(rfc?.Status) ? "\u2014" : rfc.Status;
            string tech = string.IsNullOrWhiteSpace(rfc?.AssignedTechEmail) ? "Unassigned" : rfc.AssignedTechEmail;
            string oldS = string.IsNullOrWhiteSpace(ctx?.OldStatus) ? "(unknown)" : ctx.OldStatus;
            string newS = string.IsNullOrWhiteSpace(ctx?.NewStatus) ? status : ctx.NewStatus;
            string rfcLine = $"RFC #{id}: {title}";

            switch (type)
            {
                case NotificationType.RFCAssigned:
                    return ($"RFC #{id} assigned: {title}",
                        $"{actor} raised RFC #{id} and assigned it to {tech}.",
                        new List<string> { rfcLine, $"Status: {status}" });

                case NotificationType.RFCResponded:
                    return ($"RFC #{id} updated: {title}",
                        $"{actor} updated RFC #{id}.",
                        new List<string> { rfcLine, $"Status: {status}" });

                case NotificationType.RFCStatusChanged:
                {
                    string headline; string subject;
                    if (IsClosingStatus(newS))
                    {
                        headline = $"{actor} has {ClosureVerb(newS)} RFC #{id}.";
                        subject = $"RFC #{id} {ClosureVerb(newS)}";
                    }
                    else
                    {
                        headline = $"{actor} changed the status of RFC #{id}.";
                        subject = $"RFC #{id} is now {newS}";
                    }
                    return (subject, headline, new List<string> { rfcLine, $"Status: {oldS} \u2192 {newS}" });
                }

                default:
                    return ($"Notification \u2014 RFC #{id}", $"RFC #{id} has an update.", new List<string> { rfcLine });
            }
        }

        private static readonly string[] ClosingStatuses =
            { "closed", "solved", "resolved", "complete", "completed", "withdrawn", "rejected", "cancelled" };

        private static bool IsClosingStatus(string status)
        {
            if (string.IsNullOrWhiteSpace(status)) return false;
            return System.Array.IndexOf(ClosingStatuses, status.Trim().ToLowerInvariant()) >= 0;
        }

        // The closure verb stays true to the status used (Solved -> solved,
        // Withdrawn -> withdrawn, Complete -> completed, ...).
        private static string ClosureVerb(string status)
        {
            string s = (status ?? "").Trim().ToLowerInvariant();
            return s switch
            {
                "closed" => "closed",
                "solved" => "solved",
                "resolved" => "resolved",
                "complete" => "completed",
                "completed" => "completed",
                "withdrawn" => "withdrawn",
                "rejected" => "rejected",
                "cancelled" => "cancelled",
                _ => "marked as " + (status ?? "").Trim(),
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

        // Wrap the headline + metadata facts in the Govtech Helpdesk email shell.
        private static string BuildBody(string headline, List<string> facts)
        {
            string factsHtml = string.Join("", (facts ?? new List<string>())
                .Where(f => !string.IsNullOrWhiteSpace(f))
                .Select(f => "<tr><td>" + f + "</td></tr>"));

            return
                "<div style=\"margin-bottom:30px;\">" +
                "<table style=\"border-radius:3px; width:800px; padding-left:20px; " +
                "background-color:#eaeaea; border:solid grey 1px;\">" +
                "<thead style=\"font-size:18px;\"><tr style=\"height:40px; color:white; " +
                "font-size:20px; background-color:#484848;\">" +
                "<td><b>Govtech Helpdesk - Notification</b></td></tr></thead>" +
                "<tbody style=\"font-size:16px;\">" +
                "<tr><td><b>" + headline + "</b></td></tr>" +
                factsHtml +
                "<tr><td>&nbsp;</td></tr>" +
                "<tr><td><b>Please log into Govtech Helpdesk to view and respond.</b></td></tr>" +
                "<tr><td>Please do not reply to this email as it is only a notification and replies are not monitored.<br>" +
                "Never use a link in an email to access the helpdesk as a security measure. " +
                "Instead search for the website using your browser.</td></tr>" +
                "</tbody></table></div>";
        }
    }
}
