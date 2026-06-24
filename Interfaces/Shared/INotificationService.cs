using HelpDeskNet8.Interfaces.Users;

namespace HelpDeskNet8.Interfaces.Shared
{
    // The kind of event that triggered a notification. Drives both the
    // recipient rules and the email subject/body wording.
    public enum NotificationType
    {
        // A task on the ticket was created, updated, or completed.
        TaskSaved,

        // A brand-new ticket was created (its opening description note).
        // Routes to the helpdesk inbox, not the originator. HD35 B1/B3.
        TicketCreated,

        // A note/reply was added to the ticket.
        NoteResponded,

        // A ticket was saved as a reply (no assigned-tech change).
        TicketResponded,

        // A ticket's assigned tech was changed.
        TicketAssigned,

        // An RFC was saved as a reply / update.
        RFCResponded,

        // An RFC was created or its assigned tech changed.
        RFCAssigned,
    }

    // Server-side notification routing. Resolves the recipients for a ticket
    // event from the ticket's own data and sends the email. A mail failure must
    // never break the originating save, so implementations swallow their errors.
    public interface INotificationService
    {
        void Notify(int ticketId, NotificationType type, IUser user);

        // RFCs are internal-only; recipients come from the RFC itself, so no
        // IUser is needed for scoping.
        Task NotifyRFC(int rfcId, NotificationType type);
    }
}
