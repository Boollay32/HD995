namespace HelpDeskNet8.Interfaces.Tickets
{
    public interface ITicketStub
    {
        int? TicketID { get; set; }
        DateTime? Created { get; set; }
        DateTime? Updated { get; set; }
        string RequestType { get; set; }
        string Notes { get; set; }
        string UserName { get; set; }
        string StatusDesc { get; set; }
        string Status { get; set; }
        string AssignedTech { get; set; }
        int? AssignedTechID { get; set; }
        DateTime? TargetDate { get; set; }
        string Authority { get; set; }
    }
}