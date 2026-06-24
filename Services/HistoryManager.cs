using HelpDeskNet8.Interfaces.Shared;
using HelpDeskNet8.Interfaces.Users;
using HelpDeskNet8.Models.Shared;
using Microsoft.Data.SqlClient;
using System.Data;

namespace HelpDeskNet8.Services
{
    public class HistoryManager : List<HistoryListItem>, IHistory
    {

        private readonly IDbConnection _connection;

        public HistoryManager(IDbConnection connection)
        {
            _connection = connection;
        }

        public async Task<object> GetHistory(IUser user, int TicketID)
        {
            var conn = (SqlConnection)_connection;
            using (SqlCommand command = conn.CreateCommand())
            {
                command.CommandType = CommandType.StoredProcedure;

                command.CommandText = "[dbo].[usp_Helpdesk_GetHistoryDetail]";
                command.Parameters.Add(new SqlParameter("@TicketID", SqlDbType.Int) { Value = TicketID });
                command.Parameters.Add(new SqlParameter("@UserID", SqlDbType.Int) { Value = user.UserID });

                await conn.OpenAsync();
                try
                {
                    using (SqlDataReader reader = await command.ExecuteReaderAsync())
                    {

                        this.Clear();

                        while (await reader.ReadAsync())
                        {
                            var newitem = HistoryListItem.FromReader(reader);
                            if (newitem != null)
                            {
                                this.Add(newitem);
                            }
                        }
                    }
                    await conn.CloseAsync();
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"[{GetType().Name}] {ex.Message}");
                }
                finally
                {
                    await conn.CloseAsync();
                }
            }

            return this;
        }

    }
}
