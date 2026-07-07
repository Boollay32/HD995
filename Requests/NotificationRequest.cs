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

    public class TicketPipsRequest : AuthenticatedRequest
    {
        public int TicketId { get; set; }
    }

    public class MarkPipReadRequest : AuthenticatedRequest
    {
        public int TicketId { get; set; }
        public string Kind { get; set; } // "note" or "task"
    }
}
