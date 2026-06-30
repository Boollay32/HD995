using HelpDeskNet8.Interfaces.Users;

namespace HelpDeskNet8.Interfaces.Shared
{
    // The kind of event that triggered a notification. Drives both the
    // recipient rules and the email subject/body wording.
    public enum NotificationType
    {
        // A task was created.
        TaskCreated,

        // A task was edited (anything other than its status or assignee).
        TaskUpdated,

        // A task's status changed.
        TaskStatusChanged,

        // A task's assignee was set or changed.
        TaskAssigned,

        // A brand-new ticket was created (its opening description note).
        TicketCreated,

        // A note/reply was added to the ticket.
        NoteResponded,

        // A ticket was saved as a reply (no assigned-tech / status change).
        TicketResponded,

        // A ticket's assigned tech was changed.
        TicketAssigned,

        // A ticket's status changed.
        TicketStatusChanged,

        // An RFC was saved as a reply / update.
        RFCResponded,

        // An RFC was created / assigned.
        RFCAssigned,

        // An RFC's status changed.
        RFCStatusChanged,
    }

    // Optional change-context a caller passes alongside an event so the service
    // can route correctly and word the body with the specific change. All fields
    // are optional; the service guards nulls.
    public class NotificationContext
    {
        public string? OldStatus { get; set; }            // ticket / RFC status, before
        public string? NewStatus { get; set; }            // ticket / RFC status, after
        public bool? NoteVisibleToClient { get; set; }    // a reply's client visibility
        public string? TaskTitle { get; set; }
        public int? OldTaskStatus { get; set; }
        public int? NewTaskStatus { get; set; }
        public string? TaskAssigneeName { get; set; }     // new assignee display name (best-effort match)
        public string? OldTaskAssigneeName { get; set; }  // previous assignee, to word assign vs reassign
        public string? OldTechEmail { get; set; }         // previous ticket tech, to word assign vs reassign
        public bool? TechAlsoChanged { get; set; }         // a status save that also reassigned the tech
    }

    // Server-side notification routing. Resolves the recipients for an event from
    // the ticket/RFC data (+ the optional context) and sends the email. A mail
    // failure must never break the originating save, so implementations swallow
    // their errors.
    public interface INotificationService
    {
        Task Notify(int ticketId, NotificationType type, IUser user, NotificationContext? context = null);

        // RFCs are internal-only. The acting user is needed so the saver is never
        // emailed their own change, and for the body wording.
        Task NotifyRFC(int rfcId, NotificationType type, IUser user, NotificationContext? context = null);
    }
}
