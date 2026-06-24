using HelpDeskNet8.Interfaces.Shared;
using HelpDeskNet8.Interfaces.Users;
using HelpDeskNet8.Models.Shared;
using HelpDeskNet8.Models.Users;
using HelpDeskNet8.Utilities;
using HelpDeskNet8.Infrastructure;
using Microsoft.Data.SqlClient;
using System.Data;

namespace HelpDeskNet8.Services
{
    public class UserManager(IDbConnection connection) : IUserManager
    {
        private readonly IDbConnection _connection = connection;

        public async Task<IEnumerable<IUserStub>> GetUsers(IFilter filter)
        {
            filter ??= new Filter();
            var userList = new UserList();

            if (filter.Deactivated == 1)
                filter.Locked = 99;

            var conn = (SqlConnection)_connection;
            using (SqlCommand command = conn.CreateCommand())
            {
                command.CommandType = CommandType.StoredProcedure;
                command.CommandText = "[dbo].[usp_Helpdesk_GetUsers]";

                command.Parameters.Add(new SqlParameter("@UserID", SqlDbType.Int) { Value = filter.UserID });
                command.Parameters.Add(new SqlParameter("@UserLogin", SqlDbType.NVarChar) { Value = filter.UserLogin });
                command.Parameters.Add(new SqlParameter("@UserFirstName", SqlDbType.NVarChar) { Value = filter.UserFirstName });
                command.Parameters.Add(new SqlParameter("@UserLastName", SqlDbType.NVarChar) { Value = filter.UserLastName });
                command.Parameters.Add(new SqlParameter("@UserEmail", SqlDbType.NVarChar) { Value = filter.UserEmail });
                command.Parameters.Add(new SqlParameter("@UserSecondaryEmail", SqlDbType.NVarChar) { Value = filter.UserSecondaryEmail });
                command.Parameters.Add(new SqlParameter("@UserName", SqlDbType.NVarChar) { Value = filter.UserName });
                command.Parameters.Add(new SqlParameter("@UserPhone", SqlDbType.NVarChar) { Value = filter.UserPhone });
                command.Parameters.Add(new SqlParameter("@AuthorityID", SqlDbType.Int) { Value = filter.Authority });
                command.Parameters.Add(new SqlParameter("@DepartmentID", SqlDbType.Int) { Value = filter.DepartmentID });
                command.Parameters.Add(new SqlParameter("@LockedStatus", SqlDbType.Int) { Value = filter.Locked });

                await conn.OpenAsync();
                try
                {
                    using (SqlDataReader reader = await command.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                            userList.Add(UserStub.FromReader(reader));
                    }
                }
                catch (Exception ex)
                {
                    AppLogger.Error(nameof(UserManager), ex);
                }
                finally
                {
                    if (_connection.State == ConnectionState.Open)
                        await conn.CloseAsync();
                }
            }

            return userList;
        }

        public async Task<IUser?> GetUserDetail(int userID)
        {
            IUser? newUser = null;

            var conn = (SqlConnection)_connection;
            using (SqlCommand command = conn.CreateCommand())
            {
                command.CommandType = CommandType.StoredProcedure;
                command.CommandText = "[dbo].[usp_Helpdesk_GetUserDetail]";
                command.Parameters.Add(new SqlParameter("@UserID", SqlDbType.Int) { Value = userID });

                await conn.OpenAsync();
                try
                {
                    using (SqlDataReader reader = await command.ExecuteReaderAsync())
                    {
                        if (await reader.ReadAsync() && reader["UserID"] != DBNull.Value)
                        {
                            newUser = new User
                            {
                                UserID = reader["UserID"] as int?,
                                UserEmail = reader["Email"] as string,
                                UserName = reader["User Name"] as string,
                                Authority = (string)reader["Authority"],
                                UserPhone = (string)reader["Phone"],
                                LastConnectionDate = reader["Last Connection Date"] as DateTime?,
                                Locked = (int?)reader["Locked"],
                                AdminLevel = (string)reader["AdminLevel"]
                            };
                        }
                    }
                }
                catch (Exception ex)
                {
                    AppLogger.Error(nameof(UserManager), ex);
                }
                finally
                {
                    if (_connection.State == ConnectionState.Open)
                        await conn.CloseAsync();
                }
            }

            return newUser;
        }

        public async Task<string> CreateUser(string userLogin, string fName, string sName, string phone, int authority, int department, int utc)
        {
            string result = string.Empty;

            var conn = (SqlConnection)_connection;
            using (SqlCommand command = conn.CreateCommand())
            {
                command.CommandType = CommandType.StoredProcedure;
                command.CommandText = "[usp_Helpdesk_AddUser]";

                command.Parameters.Add(new SqlParameter("@UserLogin", SqlDbType.NVarChar) { Value = userLogin });
                command.Parameters.Add(new SqlParameter("@UserFirstName", SqlDbType.NVarChar) { Value = fName });
                command.Parameters.Add(new SqlParameter("@UserLastName", SqlDbType.NVarChar) { Value = sName });
                command.Parameters.Add(new SqlParameter("@UserPhone", SqlDbType.NVarChar) { Value = phone });
                command.Parameters.Add(new SqlParameter("@AuthorityID", SqlDbType.Int) { Value = authority });
                command.Parameters.Add(new SqlParameter("@DepartmentID", SqlDbType.Int) { Value = department });
                command.Parameters.Add(new SqlParameter("@UTC", SqlDbType.Int) { Value = utc });

                await conn.OpenAsync();
                try
                {
                    result = (string)await command.ExecuteScalarAsync();
                }
                catch (Exception ex)
                {
                    AppLogger.Error(nameof(UserManager), ex);
                }
                finally
                {
                    if (_connection.State == ConnectionState.Open)
                        await conn.CloseAsync();
                }
            }

            return result;
        }

        public async Task<string> DeleteUser(string adminUser, string userLogin)
        {
            string result = string.Empty;

            var conn = (SqlConnection)_connection;
            using (SqlCommand command = conn.CreateCommand())
            {
                command.CommandType = CommandType.StoredProcedure;
                command.CommandText = "[usp_Helpdesk_UserDelete]";

                command.Parameters.Add(new SqlParameter("@UserLogin", SqlDbType.NVarChar) { Value = userLogin });
                command.Parameters.Add(new SqlParameter("@AdminUserLogin", SqlDbType.NVarChar) { Value = adminUser });

                await conn.OpenAsync();
                try
                {
                    result = (string)await command.ExecuteScalarAsync();
                }
                catch (Exception ex)
                {
                    AppLogger.Error(nameof(UserManager), ex);
                }
                finally
                {
                    if (_connection.State == ConnectionState.Open)
                        await conn.CloseAsync();
                }
            }

            return result;
        }

        public async Task<string> ResetUser(string userLogin)
        {
            string pin = string.Empty;

            var conn = (SqlConnection)_connection;
            using (SqlCommand command = conn.CreateCommand())
            {
                command.CommandType = CommandType.StoredProcedure;
                command.CommandText = "[usp_Helpdesk_ResetUser]";
                command.Parameters.Add(new SqlParameter("@UserLogin", SqlDbType.NVarChar) { Value = userLogin });

                await conn.OpenAsync();
                try
                {
                    pin = (string)await command.ExecuteScalarAsync();
                }
                catch (Exception ex)
                {
                    AppLogger.Error(nameof(UserManager), ex);
                }
                finally
                {
                    if (_connection.State == ConnectionState.Open)
                        await conn.CloseAsync();
                }
            }

            return pin;
        }

        public async Task<string> GetUserEmailAddress(int userID, string userFirstName, string userLastName, string authorityName)
        {
            string message = string.Empty;

            var conn = (SqlConnection)_connection;
            using (SqlCommand command = conn.CreateCommand())
            {
                command.CommandType = CommandType.StoredProcedure;
                command.CommandText = "[usp_Helpdesk_GetEmailAddress]";

                command.Parameters.Add(new SqlParameter("@UserID", SqlDbType.Int) { Value = userID });
                command.Parameters.Add(new SqlParameter("@UserFirstName", SqlDbType.NVarChar) { Value = string.IsNullOrWhiteSpace(userFirstName) ? (object)DBNull.Value : userFirstName });
                command.Parameters.Add(new SqlParameter("@UserLastName", SqlDbType.NVarChar) { Value = string.IsNullOrWhiteSpace(userLastName) ? (object)DBNull.Value : userLastName });
                command.Parameters.Add(new SqlParameter("@Authority", SqlDbType.NVarChar) { Value = string.IsNullOrWhiteSpace(authorityName) ? (object)DBNull.Value : authorityName });

                await conn.OpenAsync();
                try
                {
                    using (SqlDataReader reader = await command.ExecuteReaderAsync())
                    {
                        if (await reader.ReadAsync())
                            message = reader["EMailAddress"] as string ?? string.Empty;
                    }
                }
                catch (Exception ex)
                {
                    AppLogger.Error(nameof(UserManager), ex);
                }
                finally
                {
                    if (_connection.State == ConnectionState.Open)
                        await conn.CloseAsync();
                }
            }

            return message;
        }

        public async Task<int> UpdateUser(string userLogin, string phone)
        {
            int updated = 0;

            var conn = (SqlConnection)_connection;
            using (SqlCommand command = conn.CreateCommand())
            {
                command.CommandType = CommandType.StoredProcedure;
                command.CommandText = "[usp_Helpdesk_UpdateUser]";

                command.Parameters.Add(new SqlParameter("@UserLogin", SqlDbType.NVarChar) { Value = userLogin });
                command.Parameters.Add(new SqlParameter("@UserPhone", SqlDbType.NVarChar) { Value = phone });

                await conn.OpenAsync();
                try
                {
                    using (SqlDataReader reader = await command.ExecuteReaderAsync())
                    {
                        if (await reader.ReadAsync())
                            updated = (int)reader["AdminCheck"];
                    }
                }
                catch (Exception ex)
                {
                    AppLogger.Error(nameof(UserManager), ex);
                }
                finally
                {
                    if (_connection.State == ConnectionState.Open)
                        await conn.CloseAsync();
                }
            }

            return updated;
        }

        public async Task<string> ManageUser(string userLogin, string adminUserLogin, int? unlockUser, int adminLevelID, string phone)
        {
            string updated = string.Empty;

            var conn = (SqlConnection)_connection;
            using (SqlCommand command = conn.CreateCommand())
            {
                command.CommandType = CommandType.StoredProcedure;
                command.CommandText = "[usp_Helpdesk_UserManage]";

                command.Parameters.Add(new SqlParameter("@UserLogin", SqlDbType.NVarChar) { Value = userLogin });
                command.Parameters.Add(new SqlParameter("@AdminUserLogin", SqlDbType.NVarChar) { Value = adminUserLogin });
                // null => @UnlockUser = NULL => proc leaves the lock state alone.
                command.Parameters.Add(new SqlParameter("@UnlockUser", SqlDbType.Int) { Value = SqlValue.OrNull(unlockUser) });
                command.Parameters.Add(new SqlParameter("@AdminLevelID", SqlDbType.Int) { Value = adminLevelID });
                command.Parameters.Add(new SqlParameter("@UserPhone", SqlDbType.NVarChar) { Value = phone });

                await conn.OpenAsync();
                try
                {
                    updated = (string)await command.ExecuteScalarAsync();
                }
                catch (Exception ex)
                {
                    AppLogger.Error(nameof(UserManager), ex);
                }
                finally
                {
                    if (_connection.State == ConnectionState.Open)
                        await conn.CloseAsync();
                }
            }

            return updated;
        }
    }
}
