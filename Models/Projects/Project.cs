using HelpDeskNet8.Interfaces.Projects;

namespace HelpDeskNet8.Models.Projects
{
    // Project detail: the header fields plus the project's tickets.
    public class Project : IProject
    {
        public int ProjectID { get; set; }
        public string ProjectName { get; set; }
        public int ProjectTypeID { get; set; }
        public string ProjectType { get; set; }
        public int StatusID { get; set; }
        public string Status { get; set; }
        public string Description { get; set; }
        public int OwnerID { get; set; }
        public string OwnerName { get; set; }
        public int CreatedBy { get; set; }
        public string CreatedByName { get; set; }
        public DateTime? CreatedDate { get; set; }
        public DateTime? LastUpdateDate { get; set; }
        public DateTime? TargetDate { get; set; }
        public DateTime? CompletionDate { get; set; }
        public int TicketCount { get; set; }
        public int OpenTicketCount { get; set; }

        public List<ProjectTicketStub> Tickets { get; set; } = new();
    }
}
