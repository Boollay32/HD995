namespace HelpDeskNet8.Models.Projects
{
    // Inbound payload for create/update. ProjectID null/0 = create.
    public class SaveProjectModel
    {
        public int? ProjectID { get; set; }
        public string ProjectName { get; set; }
        public int ProjectTypeID { get; set; }
        public int StatusID { get; set; }
        public string Description { get; set; }
        public int OwnerID { get; set; }
        public DateTime? TargetDate { get; set; }
    }
}
