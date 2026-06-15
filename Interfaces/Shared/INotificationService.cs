using HelpDeskNet8.Interfaces.Users;

namespace HelpDeskNet8.Interfaces.Shared
{
    // The kind of event that triggered a notification. Drives both the
    // recipient rules and the email subject/body wording.
    public enum NotificationType
    {
        // A task on the ticket was created, updated, or completed.
        TaskSaved,

        // A note/reply was added to the ticket.
        NoteResponded,
    }

    // Server-side notification routing. Resolves the recipients for a ticket
    // event from the ticket's own data and sends the email. A mail failure must
    // never break the originating save, so implementations swallow their errors.
    public interface INotificationService
    {
        void Notify(int ticketId, NotificationType type, IUser user);
    }
}
