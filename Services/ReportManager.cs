using HelpDeskNet8.Interfaces.Shared;
using HelpDeskNet8.Models.Shared;
using Microsoft.Data.SqlClient;
using HelpDeskNet8.Utilities;
using System.Data;

namespace HelpDeskNet8.Services
{
    public class ReportManager : List<ReportListItem>, IReports
    {
        private readonly IDbConnection _connection;

        public ReportManager(IDbConnection connection)
        {
            _connection = connection;
        }

        // Returns report rows as a list of column-name -> value maps. A DataTable cannot
        // be serialised by System.Text.Json (DataColumn.DataType is a System.Type, which
        // throws NotSupportedException -> HTTP 500), and the Stats page's CreateDynamicTable
        // expects an array of row objects keyed by column name -- exactly this shape.
        public async Task<List<Dictionary<string, object>>> GetStats(Int32 StatsID)
        {
            var rows = new List<Dictionary<string, object>>();

            var conn = (SqlConnection)_connection;
            try
            {
                using (SqlCommand command = conn.CreateCommand())
                {
                    command.CommandType = CommandType.StoredProcedure;
                    command.CommandText = "[dbo].[usp_Helpdesk_TicketStats]";
                    command.Parameters.Add(new SqlParameter("@ReportNo", SqlDbType.Int) { Value = StatsID });
                    await conn.OpenAsync();

                    using (SqlDataReader reader = await command.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            var row = new Dictionary<string, object>();
                            for (int i = 0; i < reader.FieldCount; i++)
                                row[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i);
                            rows.Add(row);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                AppLogger.Error(nameof(ReportManager), ex);
            }
            finally
            {
                if (_connection.State == ConnectionState.Open)
                    await conn.CloseAsync();
            }

            return rows;
        }
    }
}
