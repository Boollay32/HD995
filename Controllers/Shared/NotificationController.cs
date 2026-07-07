using HelpDeskNet8.Infrastructure;
using HelpDeskNet8.Interfaces.Shared;
using HelpDeskNet8.Interfaces.Users;
using HelpDeskNet8.Requests;
using Microsoft.AspNetCore.Mvc;

namespace HelpDeskNet8.Controllers.Shared
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class NotificationController(INotificationManager notificationM, IAuthenticator auth) : ControllerBase
    {
        private readonly INotificationManager _notificationManager = notificationM;
        private readonly IAuthenticator _authenticator = auth;

        [HttpPost]
        public async Task<IActionResult> GetNotifications([FromBody] GetNotificationsRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null || !user.UserID.HasValue) return Unauthorized();

            var (notifications, unreadCount) = await _notificationManager.GetForUser(user.UserID.Value);

            // Clients get a scoped inbox: messages on their tickets and status
            // changes only -- the other event types are internal workflow noise
            // to them. Internal levels see all event types. The unread count is
            // recomputed from the filtered set so the badge matches the panel.
            int level = await _authenticator.CheckAdmin(user);
            if (level == Constants.AdminLevel.Authority)
            {
                var allowed = new[]
                {
                    (byte)NotificationType.NoteResponded,
                    (byte)NotificationType.TicketStatusChanged,
                    (byte)NotificationType.TicketAssigned,
                };
                notifications = notifications.Where(n => allowed.Contains(n.EventType)).ToList();
                unreadCount = notifications.Count(n => n.ReadDate == null);
            }

            return Ok(new { notifications, unreadCount });
        }

        [HttpPost]
        public async Task<IActionResult> MarkRead([FromBody] MarkNotificationReadRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null || !user.UserID.HasValue) return Unauthorized();

            // The proc keys the UPDATE on the caller's own user id (IDOR
            // backstop) -- a forged NotificationID can only ever touch rows
            // the caller already owns.
            await _notificationManager.MarkRead(user.UserID.Value, request.NotificationID);
            return Ok();
        }

        [HttpPost]
        public async Task<IActionResult> TicketPips([FromBody] TicketPipsRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null || !user.UserID.HasValue) return Unauthorized();

            var (note, task) = await _notificationManager.GetTicketPips(user.UserID.Value, request.TicketId);
            return Ok(new { noteUnread = note, taskUnread = task });
        }

        [HttpPost]
        public async Task<IActionResult> MarkPipRead([FromBody] MarkPipReadRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null || !user.UserID.HasValue) return Unauthorized();

            // The proc keys the UPDATE on the caller's own user id (IDOR
            // backstop) and on the ticket + kind, so a forged request can only
            // touch the caller's own rows.
            await _notificationManager.MarkReadByKind(user.UserID.Value, request.TicketId, request.Kind);
            return Ok();
        }
    }
}
