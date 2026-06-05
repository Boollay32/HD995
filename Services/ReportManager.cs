using HelpDeskNet8.Interfaces.Shared;
using HelpDeskNet8.Models.Shared;
using Microsoft.Data.SqlClient;
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
        public List<Dictionary<string, object>> GetStats(Int32 StatsID)
        {
            var rows = new List<Dictionary<string, object>>();

            try
            {
                using (IDbCommand command = _connection.CreateCommand())
                {
                    command.CommandType = CommandType.StoredProcedure;
                    command.CommandText = "[dbo].[usp_Helpdesk_TicketStats]";
                    command.Parameters.Add(new SqlParameter("@ReportNo", SqlDbType.Int) { Value = StatsID });
                    _connection.Open();

                    using (IDataReader reader = command.ExecuteReader())
                    {
                        while (reader.Read())
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
                Console.Error.WriteLine($"[{GetType().Name}] {ex.Message}");
            }
            finally
            {
                if (_connection.State == ConnectionState.Open)
                    _connection.Close();
            }

            return rows;
        }
    }
}
