using HelpDeskNet8.Requests;

namespace HelpDeskNet8.Requests
{
    public class GetProjectsRequest : AuthenticatedRequest
    {
        public int? StatusId { get; set; }
    }

    public class GetProjectDetailRequest : AuthenticatedRequest
    {
        public int ProjectId { get; set; }
    }
}
