using HelpDeskNet8.Interfaces.RFCs;
using HelpDeskNet8.Interfaces.Shared;
using HelpDeskNet8.Models.RFCs;
using HelpDeskNet8.Models.Shared;
using HelpDeskNet8.Infrastructure;
using Microsoft.Data.SqlClient;
using System.Data;

namespace HelpDeskNet8.Services
{
    public class RFCManager(IDbConnection connection) : IRFCManager
    {
        private readonly IDbConnection _connection = connection;

        public IEnumerable<IRFCStub> GetRFCs(int? CRUserID, IFilter filter)
        {
            if (filter == null)
                filter = new Filter();

            var RFCList = new RFCListItem();

            using (IDbCommand command = _connection.CreateCommand())
            {
                command.CommandType = CommandType.StoredProcedure;
                command.CommandText = "[dbo].[usp_Helpdesk_RFCGet]";

                command.Parameters.Add(new SqlParameter("@ChangeRequestUserID", SqlDbType.Int) { Value = SqlValue.OrNull(CRUserID) });
                command.Parameters.Add(new SqlParameter("@ChangeRequestID", SqlDbType.Int) { Value = SqlValue.OrNull(filter.RFCID) });
                command.Parameters.Add(new SqlParameter("@ChangeRequestTitle", SqlDbType.NVarChar) { Value = SqlValue.OrNull(filter.Title) });
                command.Parameters.Add(new SqlParameter("@ChangeRequestAssignedTo", SqlDbType.NVarChar) { Value = SqlValue.OrNull(filter.AssignedTechName) });
                command.Parameters.Add(new SqlParameter("@ChangeRequestCreatedBy", SqlDbType.NVarChar) { Value = SqlValue.OrNull(filter.CreatedByTech) });
                command.Parameters.Add(new SqlParameter("@ChangeRequestCreateDate", SqlDbType.DateTime) { Value = SqlValue.OrNull(filter.CreateDate) });
                command.Parameters.Add(new SqlParameter("@ChangeRequestCreateDateTo", SqlDbType.DateTime) { Value = SqlValue.OrNull(filter.DateTo) });
                command.Parameters.Add(new SqlParameter("@ChangeRequestStatusID", SqlDbType.NVarChar) { Value = SqlValue.OrNull(filter.Status) });
                command.Parameters.Add(new SqlParameter("@ChangeRequestPriorityID", SqlDbType.NVarChar) { Value = SqlValue.OrNull(filter.Priority) });

                _connection.Open();
                try
                {
                    using (IDataReader reader = command.ExecuteReader())
                    {
                        while (reader.Read())
                        {
                            RFCList.Add(RFCStub.FromReader(reader));
                        }
                    }
                    return RFCList;
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"[{GetType().Name}] {ex.Message}");
                    return null;
                }
                finally
                {
                    _connection.Close();
                }
            }
        }

        public IRFC GetRFCDetail(int? RFCID)
        {
            using (IDbCommand command = _connection.CreateCommand())
            {
                command.CommandType = CommandType.StoredProcedure;
                command.CommandText = "[dbo].[usp_Helpdesk_RFCGetDetail]";
                command.Parameters.Add(new SqlParameter("@ChangeRequestID", SqlDbType.Int) { Value = SqlValue.OrNull(RFCID) });

                _connection.Open();
                try
                {
                    IRFC rfc = null;
                    using (IDataReader reader = command.ExecuteReader())
                    {
                        if (reader.Read())
                            rfc = RFC.FromReader(reader);
                    }
                    return rfc;
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"[{GetType().Name}] {ex.Message}");
                    return null;
                }
                finally
                {
                    _connection.Close();
                }
            }
        }

        public List<object> SaveRFC(int UserID, IRFC rfc, int UTC)
        {
            using (IDbCommand command = _connection.CreateCommand())
            {
                command.CommandType = CommandType.StoredProcedure;
                command.CommandText = "[dbo].[usp_Helpdesk_RFCManage]";

                command.Parameters.Add(new SqlParameter("@ChangeRequestID", SqlDbType.Int) { Value = rfc.ChangeRequestID });
                command.Parameters.Add(new SqlParameter("@ChangeRequestUserID", SqlDbType.Int) { Value = UserID });
                command.Parameters.Add(new SqlParameter("@ChangeRequestTitle", SqlDbType.NVarChar) { Value = SqlValue.OrNull(rfc.Title) });
                command.Parameters.Add(new SqlParameter("@AssignedToUserID", SqlDbType.Int) { Value = SqlValue.OrNull(rfc.AssignedTechName) });
                command.Parameters.Add(new SqlParameter("@ChangeRequestDescription", SqlDbType.NVarChar) { Value = SqlValue.OrNull(rfc.Description) });
                command.Parameters.Add(new SqlParameter("@ChangeRequestPriorityID", SqlDbType.Int) { Value = rfc.Priority });
                command.Parameters.Add(new SqlParameter("@ChangeRequestEnvironmentID", SqlDbType.Int) { Value = rfc.Environment });
                command.Parameters.Add(new SqlParameter("@ChangeRequestStatusID", SqlDbType.Int) { Value = rfc.Status });
                command.Parameters.Add(new SqlParameter("@AffectedBusinessSystemsOrServices", SqlDbType.NVarChar) { Value = SqlValue.OrNull(rfc.AffectedBusinessSystemsOrServices) });
                command.Parameters.Add(new SqlParameter("@AffectedCustomers", SqlDbType.NVarChar) { Value = SqlValue.OrNull(rfc.AffectedCustomers) });
                command.Parameters.Add(new SqlParameter("@BusinessJustification", SqlDbType.NVarChar) { Value = SqlValue.OrNull(rfc.BusinessJustification) });
                command.Parameters.Add(new SqlParameter("@RiskAssessment", SqlDbType.NVarChar) { Value = SqlValue.OrNull(rfc.RiskAssessment) });
                command.Parameters.Add(new SqlParameter("@ImpactAnalysis", SqlDbType.NVarChar) { Value = SqlValue.OrNull(rfc.ImpactAnalysis) });
                command.Parameters.Add(new SqlParameter("@InformationSecurityConsiderations", SqlDbType.NVarChar) { Value = SqlValue.OrNull(rfc.InformationSecurityConsiderations) });
                command.Parameters.Add(new SqlParameter("@TargetDate", SqlDbType.DateTime) { Value = SqlValue.OrNull(rfc.TargetDate) });
                command.Parameters.Add(new SqlParameter("@UTC", SqlDbType.Int) { Value = UTC });
                command.Parameters.Add(new SqlParameter("@CompletedDate", SqlDbType.DateTime) { Value = SqlValue.OrNull(rfc.CompletedDate) });
                command.Parameters.Add(new SqlParameter("@ApprovedBy", SqlDbType.NVarChar) { Value = SqlValue.OrNull(rfc.ApprovedBy) });
                command.Parameters.Add(new SqlParameter("@ApprovalDate", SqlDbType.DateTime) { Value = SqlValue.OrNull(rfc.ApprovalDate) });

                _connection.Open();
                var result = new List<Object>();
                try
                {
                    if (rfc.ChangeRequestID != 0)
                    {
                        command.ExecuteNonQuery();
                        result.Add("Update");
                        result.Add(rfc.ChangeRequestID);
                    }
                    else
                    {
                        int newRFCID = (int)command.ExecuteScalar();
                        result.Add("Created");
                        result.Add(newRFCID);
                    }
                }
                catch (Exception ex)
                {
                    result.Add("Error");
                    result.Add(ex);
                }
                finally
                {
                    _connection.Close();
                }
                return result;
            }
        }
    }
}
