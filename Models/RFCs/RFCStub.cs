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
        public string AssignedTech { get; set; }
        public DateTime? TargetDate { get; set; }
        public DateTime? Created { get; set; }
        public string Priority { get; set; }


        internal static RFCStub FromReader(IDataReader reader)
        {
            RFCStub newRFCStub = null;

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
                    Priority = (string)reader["ChangeRequestPriorityDesc"],
                    TargetDate = (DateTime?)reader["TargetDate"],
                    //Completed = (DateTime?)reader["CompletedDate"],      
                };
            }

            return newRFCStub;
        }

    }

}