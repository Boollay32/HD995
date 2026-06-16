using HelpDeskNet8.Interfaces.Projects;
using HelpDeskNet8.Utilities;
using System.Data;

namespace HelpDeskNet8.Models.Projects
{
    // One row in the projects list. Roll-up counts are computed by
    // usp_Helpdesk_GetProjects (never stored on tblProject).
    public class ProjectStub : IProjectStub
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
        public int TaskCount { get; set; }
        public int DoneTaskCount { get; set; }
        public int CompletionPct { get; set; }

        internal static ProjectStub FromReader(IDataReader reader)
        {
            try
            {
                if (reader["ProjectID"] == DBNull.Value) return null;

                return new ProjectStub
                {
                    ProjectID = (int)reader["ProjectID"],
                    ProjectName = reader["ProjectName"] as string,
                    ProjectTypeID = (int)reader["ProjectTypeID"],
                    ProjectType = reader["ProjectType"] as string,
                    StatusID = (int)reader["StatusID"],
                    Status = reader["Status"] as string,
                    Description = reader["Description"] as string,
                    OwnerID = (int)reader["OwnerID"],
                    OwnerName = reader["OwnerName"] as string,
                    CreatedBy = (int)reader["CreatedBy"],
                    CreatedByName = reader["CreatedByName"] as string,
                    CreatedDate = reader["CreatedDate"] as DateTime?,
                    LastUpdateDate = reader["LastUpdateDate"] as DateTime?,
                    TargetDate = reader["TargetDate"] as DateTime?,
                    CompletionDate = reader["CompletionDate"] as DateTime?,
                    TicketCount = (int)reader["TicketCount"],
                    OpenTicketCount = (int)reader["OpenTicketCount"],
                    TaskCount = (int)reader["TaskCount"],
                    DoneTaskCount = (int)reader["DoneTaskCount"],
                    CompletionPct = (int)reader["CompletionPct"]
                };
            }
            catch (Exception ex)
            {
                AppLogger.Error(nameof(ProjectStub), ex);
                return null;
            }
        }
    }
}
