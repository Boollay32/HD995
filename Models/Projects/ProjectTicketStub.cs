using HelpDeskNet8.Utilities;
using System.Data;

namespace HelpDeskNet8.Models.Projects
{
    // A ticket as shown inside a project's detail page (result set 2 of
    // usp_Helpdesk_GetProjectDetail).
    public class ProjectTicketStub
    {
        public int TicketID { get; set; }
        public string Subject { get; set; }
        public int StatusID { get; set; }
        public string Status { get; set; }
        public int? RequestID { get; set; }
        public string RequestType { get; set; }
        public int? AssignedTechID { get; set; }
        public string AssignedTechName { get; set; }
        public DateTime? CreateDate { get; set; }
        public DateTime? TargetDate { get; set; }

        internal static ProjectTicketStub FromReader(IDataReader reader)
        {
            try
            {
                if (reader["TicketID"] == DBNull.Value) return null;

                return new ProjectTicketStub
                {
                    TicketID = (int)reader["TicketID"],
                    Subject = reader["Subject"] as string,
                    StatusID = (int)reader["StatusID"],
                    Status = reader["Status"] as string,
                    RequestID = reader["RequestID"] as int?,
                    RequestType = reader["RequestType"] as string,
                    AssignedTechID = reader["AssignedTechID"] as int?,
                    AssignedTechName = reader["AssignedTechName"] as string,
                    CreateDate = reader["CreateDate"] as DateTime?,
                    TargetDate = reader["TargetDate"] as DateTime?
                };
            }
            catch (Exception ex)
            {
                AppLogger.Error(nameof(ProjectTicketStub), ex);
                return null;
            }
        }
    }
}
