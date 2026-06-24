using HelpDeskNet8.Interfaces.Shared;
using HelpDeskNet8.Interfaces.Users;
using HelpDeskNet8.Models.Shared;
using Microsoft.Data.SqlClient;
using System.Data;

namespace HelpDeskNet8.Services
{
    public class DropdownManager : List<DropdownListItem>, IDropdowns
    {

        private readonly IDbConnection _connection;

        public DropdownManager(IDbConnection connection)
        {
            _connection = connection;
        }


        public async Task<IEnumerable<DropdownListItem>> GetDropDowns(IUser user, int Filter, string Group)
        {
            var conn = (SqlConnection)_connection;
            using (SqlCommand command = conn.CreateCommand())
            {
                command.CommandType = CommandType.StoredProcedure;
                command.CommandText = "[dbo].[usp_Helpdesk_References_1]";
                command.Parameters.Add(new SqlParameter("@UserID", SqlDbType.Int) { Value = user.UserID });
                command.Parameters.Add(new SqlParameter("@Filter", SqlDbType.Int) { Value = Filter });
                command.Parameters.Add(new SqlParameter("@Group", SqlDbType.NVarChar) { Value = Group });

                await conn.OpenAsync();

                using (SqlDataReader reader = await command.ExecuteReaderAsync())
                {
                    this.Clear();
                    try
                    {
                        while (await reader.ReadAsync())
                        {
                            var newitem = DropdownListItem.FromReader(reader);
                            if (newitem != null)
                            {
                                this.Add(newitem);
                            }
                        }
                    }
                    catch (Exception ex)
{
    Console.Error.WriteLine($"[{GetType().Name}] {ex.Message}");
}

                }
                await conn.CloseAsync();
            }

            return this;
        }

        public async Task<DataTable> GetCustomFields(IUser user, int requestID)
        {

            DataTable CustomFieldsTable = new DataTable();
            var conn = (SqlConnection)_connection;
            try
            {
                using (SqlCommand command = conn.CreateCommand())
                {
                    command.CommandType = CommandType.StoredProcedure;
                    command.CommandText = "[dbo].[usp_Helpdesk_GetCustomFields]";
                    command.Parameters.Add(new SqlParameter("@CustomFilterGroup", SqlDbType.Int) { Value = requestID });

                    await conn.OpenAsync();

                    CustomFieldsTable.Load(await command.ExecuteReaderAsync());

                    await conn.CloseAsync();
                    return CustomFieldsTable;
                }
            }
            catch (Exception ex)
{
    Console.Error.WriteLine($"[{GetType().Name}] {ex.Message}");
}

            await conn.CloseAsync();

            return null;
        }
    }
}

