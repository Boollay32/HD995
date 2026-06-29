using HelpDeskNet8.Interfaces.Users;

namespace HelpDeskNet8.Interfaces.Shared
{
    // The kind of event that triggered a notification. Drives both the
    // recipient rules and the email subject/body wording.
    public enum NotificationType
    {
        // A task was created.
        TaskCreated,

        // A task was edited (anything other than its status).
        TaskUpdated,

        // A task's status changed.
        TaskStatusChanged,

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

        // An RFC was created or its assigned tech changed.
        RFCAssigned,
    }

    // Optional change-context a caller passes alongside an event so the service
    // can route correctly (status changes -> project owner) and word the body
    // with the specific change. All fields optional; the service guards nulls.
    public class NotificationContext
    {
        public string? OldStatus { get; set; }          // ticket status, before
        public string? NewStatus { get; set; }          // ticket status, after
        public bool? NoteVisibleToClient { get; set; }  // a reply's client visibility
        public string? TaskTitle { get; set; }
        public int? OldTaskStatus { get; set; }
        public int? NewTaskStatus { get; set; }
        public string? TaskAssigneeName { get; set; }   // display name (best-effort match)
    }

    // Server-side notification routing. Resolves the recipients for a ticket
    // event from the ticket's own data (+ the optional context) and sends the
    // email. A mail failure must never break the originating save, so
    // implementations swallow their errors.
    public interface INotificationService
    {
        Task Notify(int ticketId, NotificationType type, IUser user, NotificationContext? context = null);

        // RFCs are internal-only; recipients come from the RFC itself, so no
        // IUser is needed for scoping.
        Task NotifyRFC(int rfcId, NotificationType type);
    }
}
