using HelpDeskNet8.Interfaces.RFCs;
using System.Data;
using System.Text.Json.Serialization;

namespace HelpDeskNet8.Models.RFCs
{
    public class RFCStub : IRFCStub
    {
        [JsonPropertyName("rfcID")]
        public int? RFCID { get; set; }

        public String Title { get; set; }
        public string Status { get; set; }
        public string CreatedBy { get; set; }
        public int? CreatedByID { get; set; }
        public string AssignedTech { get; set; }
        public int? AssignedTechID { get; set; }
        public DateTime? TargetDate { get; set; }
        public DateTime? Created { get; set; }
        public string Priority { get; set; }

        internal static RFCStub FromReader(IDataReader reader)
        {
            RFCStub newRFCStub = null;

            // Optional columns: unique ids for the "My open" filters. Read
            // tolerantly so older list procs without them still work.
            var cols = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            for (int i = 0; i < reader.FieldCount; i++)
                cols.Add(reader.GetName(i));
            int? OptInt(string name)
                => cols.Contains(name) && reader[name] != DBNull.Value
                    ? Convert.ToInt32(reader[name]) : (int?)null;

            if (reader["ChangeRequestID"] != DBNull.Value)
            {
                newRFCStub = new RFCStub
                {
                    RFCID = (int?)reader["ChangeRequestID"],
                    Title = (string)reader["ChangeRequestTitle"],
                    Status = (string)reader["ChangeRequestStatusDesc"],
                    CreatedBy = (string)reader["Change Request Originator"],
                    Created = reader["ChangeRequestCreateDate"] as DateTime?,
                    AssignedTech = (string)reader["AssignedTechName"],
                    AssignedTechID = OptInt("AssignedTechID") ?? OptInt("AssignedToUserID"),
                    CreatedByID = OptInt("OriginatorID") ?? OptInt("CreatedByID"),
                    Priority = (string)reader["ChangeRequestPriorityDesc"],
                    TargetDate = (DateTime?)reader["TargetDate"],
                    //Completed = (DateTime?)reader["CompletedDate"],
                };
            }

            return newRFCStub;
        }
    }
}