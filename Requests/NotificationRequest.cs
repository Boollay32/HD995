namespace HelpDeskNet8.Requests
{
    public class GetNotificationsRequest : AuthenticatedRequest
    {
    }

    public class MarkNotificationReadRequest : AuthenticatedRequest
    {
        // Null = mark all of the caller's notifications read.
        public int? NotificationID { get; set; }
    }
}
