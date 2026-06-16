namespace HelpDeskNet8.Interfaces.Projects
{
    public interface IProjectStub
    {
        int ProjectID { get; set; }
        string ProjectName { get; set; }
        int ProjectTypeID { get; set; }
        string ProjectType { get; set; }
        int StatusID { get; set; }
        string Status { get; set; }
        string Description { get; set; }
        int OwnerID { get; set; }
        string OwnerName { get; set; }
        int CreatedBy { get; set; }
        string CreatedByName { get; set; }
        DateTime? CreatedDate { get; set; }
        DateTime? LastUpdateDate { get; set; }
        DateTime? TargetDate { get; set; }
        DateTime? CompletionDate { get; set; }
        int TicketCount { get; set; }
        int OpenTicketCount { get; set; }
        int TaskCount { get; set; }
        int DoneTaskCount { get; set; }
        int CompletionPct { get; set; }
    }
}
