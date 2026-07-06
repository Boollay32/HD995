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
        private readonly INotificationManager _notificationManager;

        public NotificationService(ITicketManager ticketManager, IMiscManager miscManager, IRFCManager rfcManager, IMailPreviewSink preview, IProjectManager projectManager, IUserManager userManager, INotificationManager notificationManager)
        {
            _ticketManager = ticketManager;
            _miscManager = miscManager;
            _rfcManager = rfcManager;
            _preview = preview;
            _projectManager = projectManager;
            _userManager = userManager;
            _notificationManager = notificationManager;
        }

        // A resolved notification recipient: the email (for the SMTP send) and,
        // when known, the numeric user id (for the in-app inbox row). Email-only
        // recipients -- the shared triage inbox, RFC people until the RFC detail
        // proc exposes numeric ids -- get the email but never a row.
        private sealed record Recipient(int? UserID, string Email);

        public async Task Notify(int ticketId, NotificationType type, IUser user, NotificationContext? context = null)
        {
            try
            {
                if (ticketId <= 0) return;

                ITicket ticket = await _ticketManager.GetTicketDetail(ticketId, user);
                if (ticket == null) return;

                // Same priority order as every other identity resolver in this
                // file (ResolveAssigneeById / ResolveAssigneeByName /
                // ResolveProjectOwner): UserEmail first, UserLogin as
                // fallback. Getting this backwards here meant the actor's
                // "identity string" for self-exclusion never matched the same
                // person's email as computed by those resolvers, so the actor
                // could end up notified about their own action.
                string actorEmail = !string.IsNullOrWhiteSpace(user?.UserEmail)
                    ? user.UserEmail
                    : user?.UserLogin;

                var people = await ResolveTicketRecipients(type, ticket, user, context);

                Recipient[] recipients = StripActorAndDedupe(people, actorEmail, user?.UserID);
                if (recipients.Length == 0) return;

                var (subject, headline, facts) = BuildTicketEmail(type, ticketId, ticket, context, user);
                string body = BuildBody(headline, facts);

                // Dual-write: an in-app inbox row per recipient with a known user
                // id, from the SAME resolved set as the email -- the two outputs
                // can never disagree. Task events point at the task so the bell
                // deep-links into the ticket's drawer; everything else at the
                // ticket. Rows are written in preview mode too (dev DB).
                bool isTask = IsTaskEvent(type);
                await WriteInAppRows(recipients, type, user,
                    entityType: isTask ? (byte)2 : (byte)1,
                    entityId: isTask ? (context?.TaskID ?? ticketId) : ticketId,
                    ticketId: ticketId,
                    message: subject);

                string[] emails = recipients.Select(r => r.Email).ToArray();

                if (_preview.Enabled)
                {
                    _preview.Add(PointLabel(type), emails, subject, body);
                    return;
                }

                await _miscManager.SendMailMessage(FromAddress, emails, subject, body);
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

                // Same priority order as every other identity resolver in this
                // file -- see the matching comment in Notify() above.
                string actorEmail = !string.IsNullOrWhiteSpace(user?.UserEmail)
                    ? user.UserEmail
                    : user?.UserLogin;

                // RFCs are internal-only. Assigned (creation) -> the new tech only;
                // an update or status change -> the RFC owner + the tech.
                var people = new List<Recipient>();
                switch (type)
                {
                    case NotificationType.RFCAssigned:
                        people.Add(new Recipient(rfc.AssignedTechID, rfc.AssignedTechEmail));
                        break;
                    case NotificationType.RFCResponded:
                    case NotificationType.RFCStatusChanged:
                        people.Add(new Recipient(rfc.OriginatorID, rfc.OriginatorEmail));
                        people.Add(new Recipient(rfc.AssignedTechID, rfc.AssignedTechEmail));
                        break;
                }

                Recipient[] recipients = StripActorAndDedupe(people, actorEmail, user?.UserID);
                if (recipients.Length == 0) return;

                var (subject, headline, facts) = BuildRfcEmail(type, rfc, context, user);
                string body = BuildBody(headline, facts);

                // RFC recipients carry numeric ids (RFCGetDetail exposes
                // OriginatorID / AssignedTechID), so RFC events write in-app
                // inbox rows exactly like ticket and task events.
                await WriteInAppRows(recipients, type, user,
                    entityType: 3, entityId: rfcId, ticketId: null, message: subject);

                string[] emails = recipients.Select(r => r.Email).ToArray();

                if (_preview.Enabled)
                {
                    _preview.Add(PointLabel(type), emails, subject, body);
                    return;
                }

                await _miscManager.SendMailMessage(FromAddress, emails, subject, body);
            }
            catch
            {
                // A notification failure must never break the originating save.
            }
        }

        // ----------------------------  Recipients  ---------------------------- //

        // Drop blanks, the acting user (never self-notify -- the global caveat),
        // and duplicates, case-insensitively.
        private static Recipient[] StripActorAndDedupe(IEnumerable<Recipient> people, string actorEmail, int? actorId)
        {
            return people
                .Where(r => r != null && !string.IsNullOrWhiteSpace(r.Email))
                .Where(r => !(actorId.HasValue && r.UserID.HasValue && r.UserID.Value == actorId.Value))
                .Where(r => string.IsNullOrWhiteSpace(actorEmail)
                    || !string.Equals(r.Email, actorEmail, System.StringComparison.OrdinalIgnoreCase))
                .GroupBy(r => r.Email, System.StringComparer.OrdinalIgnoreCase)
                .Select(g => g.FirstOrDefault(x => x.UserID.HasValue) ?? g.First())
                .ToArray();
        }

        private static bool IsTaskEvent(NotificationType type)
        {
            return type == NotificationType.TaskCreated
                || type == NotificationType.TaskUpdated
                || type == NotificationType.TaskStatusChanged
                || type == NotificationType.TaskAssigned;
        }

        // In-app inbox rows (tblNotification) for every recipient with a known
        // user id. Never throws into the caller -- same contract as the mail
        // send (a notification failure must not break the originating save).
        private async Task WriteInAppRows(Recipient[] recipients, NotificationType type,
            IUser user, byte entityType, int entityId, int? ticketId, string message)
        {
            foreach (var r in recipients)
            {
                if (!r.UserID.HasValue || r.UserID.Value <= 0) continue;
                await _notificationManager.Write(r.UserID.Value, user?.UserID,
                    (byte)type, entityType, entityId, ticketId, message);
            }
        }

        // Build the recipient set for a ticket/task event, keyed on the event and
        // on whether the actor is an internal (Govtech) user or a client.
        private async Task<List<Recipient>> ResolveTicketRecipients(
            NotificationType type, ITicket ticket, IUser user, NotificationContext? context)
        {
            var people = new List<Recipient>();

            // the ticket's assigned tech (numeric id lives on the detail row)
            var tech = new Recipient(ticket.AssignedTechID, ticket.AssignedTechEmail);
            Recipient owner = await ResolveTicketOwner(ticket);  // the ticket originator / owner
            bool actorInternal = ActorIsInternal(user);
            bool clientTicket = IsClientTicket(ticket);

            switch (type)
            {
                case NotificationType.TicketCreated:
                    if (!actorInternal)
                    {
                        // A client raised the ticket -> the shared triage inbox.
                        people.Add(new Recipient(null, FromAddress));
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
                        people.Add(await ResolveProjectOwner(ticket, user));
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
                        people.Add(await ResolveProjectOwner(ticket, user));
                        people.Add(owner);
                        // HD44: a save that also reassigned the ticket sends the
                        // brand-new tech the "assigned" mail, not this status one.
                        // A pre-existing tech is still notified.
                        if (!(context?.TechAlsoChanged ?? false)) people.Add(tech);
                    }
                    break;

                case NotificationType.TicketAssigned:
                    // The newly assigned tech, AND the ticket owner: the person
                    // who raised the ticket should know it has been picked up.
                    // The wording is already neutral ("X assigned ticket #n to
                    // Y"), so one message serves both.
                    people.Add(tech);
                    people.Add(owner);
                    break;

                case NotificationType.NoteResponded:
                    // A note was created. Client -> the assigned tech; internal ->
                    // the ticket owner + the assigned tech. Client-INVISIBLE
                    // (internal) notes must never ping the owner: the context
                    // carried NoteVisibleToClient all along but was not checked
                    // here, leaking "note added" emails (and, since the inbox,
                    // rows) to clients for internal workings.
                    if (!actorInternal)
                    {
                        people.Add(tech);
                    }
                    else
                    {
                        if (context?.NoteVisibleToClient ?? true) people.Add(owner);
                        people.Add(tech);
                    }
                    break;

                case NotificationType.TaskCreated:
                case NotificationType.TaskStatusChanged:
                    // The task's own assignee is NOT included here -- they get
                    // their own dedicated TaskAssigned email; including them here
                    // too meant a double notification for one action. Just the
                    // ticket owner (the actor-strip drops them when they raised
                    // it) and the project owner.
                    if (!clientTicket) people.Add(owner);
                    people.Add(await ResolveProjectOwner(ticket, user));
                    break;

                case NotificationType.TaskUpdated:
                    // HD44: the task's own assigned tech (always) + the ticket owner
                    // (dropped if they are the actor).
                    people.Add(await ResolveTaskAssignee(context));
                    if (!clientTicket) people.Add(owner);
                    break;

                case NotificationType.TaskAssigned:
                    // -> the newly assigned task assignee (id first, name as fallback).
                    people.Add(await ResolveTaskAssignee(context));
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
        // Prefers the reliable numeric raiser id; falls back to the ticket's
        // own Email column (presumably join-based and not reliably populated
        // for every ticket type) only if that id is unavailable.
        private async Task<Recipient> ResolveTicketOwner(ITicket ticket)
        {
            if (ticket.RaisedByID.HasValue && ticket.RaisedByID.Value > 0)
            {
                try
                {
                    IUser? person = await _userManager.GetUserDetail(ticket.RaisedByID.Value);
                    string email = person == null
                        ? string.Empty
                        : (string.IsNullOrWhiteSpace(person.UserEmail) ? person.UserLogin : person.UserEmail) ?? string.Empty;
                    if (!string.IsNullOrWhiteSpace(email)) return new Recipient(ticket.RaisedByID, email);
                }
                catch
                {
                    // fall through to the Email column below
                }
            }
            // Email-column fallback: no reliable id, so no in-app row.
            return new Recipient(null, ticket.Email ?? string.Empty);
        }

        private async Task<Recipient> ResolveProjectOwner(ITicket ticket, IUser user)
        {
            if (!ticket.ProjectID.HasValue || ticket.ProjectID.Value <= 0) return new Recipient(null, string.Empty);

            IProject? project = await _projectManager.GetProjectDetail(user, ticket.ProjectID.Value);
            if (project == null || project.OwnerID <= 0) return new Recipient(null, string.Empty);

            IUser? owner = await _userManager.GetUserDetail(project.OwnerID);
            if (owner == null) return new Recipient(null, string.Empty);

            string email = (string.IsNullOrWhiteSpace(owner.UserEmail) ? owner.UserLogin : owner.UserEmail) ?? string.Empty;
            return new Recipient(project.OwnerID, email);
        }

        // Tries the reliable id-based lookup first; only falls back to the
        // fragile cross-proc name match below if no id was captured.
        private async Task<Recipient> ResolveTaskAssignee(NotificationContext? context)
        {
            Recipient byId = await ResolveAssigneeById(context?.TaskAssigneeID);
            if (!string.IsNullOrEmpty(byId.Email)) return byId;
            return await ResolveAssigneeByName(context?.TaskAssigneeName);
        }

        // Reliable path: resolve directly by user id (the task save always has
        // this). Avoids matching a display name across two independent procs
        // (see ResolveAssigneeByName below, kept as a fallback only).
        private async Task<Recipient> ResolveAssigneeById(int? assigneeId)
        {
            if (!assigneeId.HasValue || assigneeId.Value <= 0) return new Recipient(null, string.Empty);
            try
            {
                IUser? person = await _userManager.GetUserDetail(assigneeId.Value);
                if (person == null) return new Recipient(null, string.Empty);
                string email = (string.IsNullOrWhiteSpace(person.UserEmail) ? person.UserLogin : person.UserEmail) ?? string.Empty;
                return new Recipient(assigneeId, email);
            }
            catch
            {
                return new Recipient(null, string.Empty);
            }
        }

        // Fallback only, and only reached when ResolveAssigneeById has no id.
        // Best-effort: a task stores only the assignee's display NAME, so match it
        // against the user list and resolve their email. Fragile by nature
        // (duplicate / mismatched names, or -- as turned out to be the actual bug
        // here -- two different procs formatting the same person's name
        // differently) -- returns empty when there is no clean single match, and
        // never throws into the caller.
        private async Task<Recipient> ResolveAssigneeByName(string? assigneeName)
        {
            if (string.IsNullOrWhiteSpace(assigneeName)) return new Recipient(null, string.Empty);
            try
            {
                var users = await _userManager.GetUsers(new Filter());
                if (users == null) return new Recipient(null, string.Empty);

                var match = users.FirstOrDefault(u =>
                    !string.IsNullOrWhiteSpace(u.UserName)
                    && string.Equals(u.UserName.Trim(), assigneeName.Trim(), System.StringComparison.OrdinalIgnoreCase));
                if (match == null || !match.UserID.HasValue) return new Recipient(null, string.Empty);

                IUser? person = await _userManager.GetUserDetail(match.UserID.Value);
                if (person == null) return new Recipient(null, string.Empty);
                string email = (string.IsNullOrWhiteSpace(person.UserEmail) ? person.UserLogin : person.UserEmail) ?? string.Empty;
                return new Recipient(match.UserID, email);
            }
            catch
            {
                return new Recipient(null, string.Empty);
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
            string status = TicketStatusLabel(ticket?.Status);
            string tech = string.IsNullOrWhiteSpace(ticket?.AssignedTechEmail) ? "Unassigned" : ticket.AssignedTechEmail;
            string oldS = string.IsNullOrWhiteSpace(ctx?.OldStatus) ? "(unknown)" : TicketStatusLabel(ctx.OldStatus);
            string newS = string.IsNullOrWhiteSpace(ctx?.NewStatus) ? status : TicketStatusLabel(ctx.NewStatus);
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
                    bool isReassignment = !string.IsNullOrWhiteSpace(ctx?.OldTaskAssigneeName);
                    string headline = isReassignment
                        ? $"{actor} reassigned the task \"{tt}\" from {ctx.OldTaskAssigneeName} to {assignee}."
                        : $"{actor} assigned the task \"{tt}\" on ticket #{id} to {assignee}.";
                    string subject = isReassignment
                        ? "A task has been reassigned to you"
                        : "New task has been assigned to you";
                    return (subject,
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

        // Map the numeric ticket status id to its label (the wire value is the
        // id, e.g. "5"). A value already a label, or an unknown id, is returned
        // unchanged.
        private static string TicketStatusLabel(string? status)
        {
            string s = (status ?? "").Trim();
            if (s.Length == 0) return "\u2014";
            return s switch
            {
                "1" => "Open",
                "2" => "Pending",
                "3" => "Closed",
                "4" => "Cancelled",
                "5" => "Resolved",
                "6" => "CR Open",
                "7" => "CR Assigned",
                "8" => "CR Complete",
                "9" => "CR Withdrawn",
                _ => s,
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
