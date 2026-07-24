using HelpDeskNet8.Requests;

namespace HelpDeskNet8.Requests
{
    public class GetTicketsRequest : AuthenticatedRequest
    {
        public int MyTicket { get; set; }
        public Dictionary<string, string> Filters { get; set; }
    }

    public class SetTicketProjectRequest : AuthenticatedRequest
    {
        public int TicketID { get; set; }
        public int? ProjectID { get; set; }   // null = return to the CR pool
    }

    public class GetTicketDetailRequest : AuthenticatedRequest
    {
        public int TicketId { get; set; }
    }

    public class SaveTicketRequest : AuthenticatedRequest
    {
        public string ObjectInfo { get; set; }
        public bool FalseReply { get; set; }
        public int EmailSent { get; set; }
        public int? ContactClientAuthorityId { get; set; }
        public int? ContactClientUserId { get; set; }
    }
    
    public class ChangeCustomFieldsRequest : AuthenticatedRequest
    {
        public int RequestId { get; set; }
    }

    public class CreateBugOrRequestRequest : AuthenticatedRequest
    {
        public string Subject { get; set; }
        public string Description { get; set; }
        public string BugOrRequestType { get; set; }
    }
}
