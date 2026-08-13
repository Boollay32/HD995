using HelpDeskNet8.Models.Projects;

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

    public class SaveProjectRequest : AuthenticatedRequest
    {
        public SaveProjectModel Project { get; set; }
    }
}