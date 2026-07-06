using HelpDeskNet8.Models.Shared;

namespace HelpDeskNet8.Interfaces.Shared
{
    public interface INotificationManager
    {
        // Insert one in-app inbox row (usp_Helpdesk_NotificationWrite). Never
        // throws into the caller -- a notification failure must not break the
        // originating save (same contract as NotificationService itself).
        Task Write(int recipientUserId, int? actorUserId, byte eventType,
            byte entityType, int entityId, int? ticketId, string message);

        // The bell payload: the newest rows (unread first) plus the badge count.
        Task<(IEnumerable<NotificationStub> Notifications, int UnreadCount)> GetForUser(int userId, int top = 30);

        // Mark one row (or all, when notificationId is null) read. The proc
        // keys every UPDATE on the recipient id -- the IDOR backstop.
        Task MarkRead(int userId, int? notificationId);

        // Delete the user's already-read rows. Called at login so read
        // notifications survive only the session they were read in.
        Task PurgeRead(int userId);
    }
}
