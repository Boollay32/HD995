namespace HelpDeskNet8.Interfaces.Tickets
{
    public interface ITicket : ITicketStub
    {
        int? RequestID { get; set; }
        string RequestDetail { get; set; }
        new string RequestType { get; set; }
        int? TicketTypeID { get; set; }
        string Subject { get; set; }
        DateTime? NotesDate { get; set; }
        DateTime? FirstResponseDate { get; set; }
        string RaisedBy { get; set; }
        int? RaisedByID { get; set; }
        string Email { get; set; }
        new string Status { get; set; }
        string Priority { get; set; }
        int? Category { get; set; }
        string AlertLevel { get; set; }
        int? AssignedTechID { get; set; }          // ← renamed from AssignedTechName
        string AssignedTechEmail { get; set; }
        string AuthorityName { get; set; }
        string Department { get; set; }
        string Notify { get; set; }
        bool? NotifyTech { get; set; }
        string IssueTypeDesc { get; set; }
        string Customer { get; set; }
        string CallNumber { get; set; }
        string RevenuesReference { get; set; }
        DateTime? SubmissionDate { get; set; }
        string FormReference { get; set; }
        string PropertyAddress { get; set; }
        string CustomerSurname { get; set; }
        int? DocumentManagementSystemID { get; set; }
        int? RevenuesFormTypeID { get; set; }
        int? FormProviderID { get; set; }
        string ClaimantSurname { get; set; }
        string ClaimReference { get; set; }
        DateTime? ClaimDate { get; set; }
        string NINO { get; set; }
        DateTime? EstimatedCompletionDate { get; set; }
        string ResourceRequired { get; set; }
        string WebCaptureImpact { get; set; }
        int? UserAuthorityID { get; set; }
        DateTime? DateAssignedtoRelease { get; set; }
        int? WebCaptureReleaseID { get; set; }
        int? WebCaptureTypeID { get; set; }
        int? WebCaptureStatusID { get; set; }
        int? ReleasePriorityID { get; set; }
        int? eCaptureCRTypeID { get; set; }
        int? eCaptureReleaseID { get; set; }
        int? eCaptureStatusID { get; set; }
        string WebCaptureBENsProcess { get; set; } // ← removed WebCAPTUREBensProcess duplicate
        string WebCaptureREVsProcess { get; set; }
        string eCaptureCategory { get; set; }
        string EmailCC { get; set; }
        string ProjectName { get; set; }
        int? ProjectTypeID { get; set; }
        int? ProjectID { get; set; }
        string FileName { get; set; }
        string BusinessImpact { get; set; }
        DateTime? IncidentStartDate { get; set; }
        DateTime? TargetDate { get; set; }
        DateTime? CompleteDate { get; set; }
        ITicket GetChanges();                      // ← removed ITicketManager + IUser params
    }
}
