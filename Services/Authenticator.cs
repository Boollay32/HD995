using HelpDeskNet8.Infrastructure;
using HelpDeskNet8.Interfaces.Shared;
using HelpDeskNet8.Interfaces.Users;
using HelpDeskNet8.Models.Users;
using HelpDeskNet8.Utilities;
using Microsoft.Data.SqlClient;
using System.Data;

namespace HelpDeskNet8.Services
{
    public class Authenticator(string connectionString) : IAuthenticator
    {
        private readonly SqlConnection _connection = new SqlConnection(connectionString);

        public int StatusCode { get; private set; }
        public string? StatusText { get; private set; }

        public async Task<IUser?> AuthenticateByPassword(string username, string password,
            int UTC, string? newPassword = null)
        {
            IUser? user = null;

            using (SqlCommand command = _connection.CreateCommand())
            {
                command.CommandType = CommandType.StoredProcedure;
                command.CommandText = "[dbo].[usp_Helpdesk_Login]";

                command.Parameters.Add(new SqlParameter("@UserName", SqlDbType.NVarChar) { Value = username });
                command.Parameters.Add(new SqlParameter("@UserPassword", SqlDbType.NVarChar) { Value = password });
                command.Parameters.Add(new SqlParameter("@UserPasswordChanged", SqlDbType.NVarChar) { Value = (object?)newPassword ?? DBNull.Value });
                command.Parameters.Add(new SqlParameter("@UTC", SqlDbType.Int) { Value = UTC });

                await _connection.OpenAsync();
                try
                {
                    using (SqlDataReader reader = await command.ExecuteReaderAsync())
                    {
                        if (await reader.ReadAsync())
                        {
                            user = User.FromReader(reader);
                            StatusCode = (int)reader["ResponseCode"];
                            StatusText = (string)reader["ResponseStatus"];
                        }
                    }
                }
                catch (Exception ex)
                {
                    // Fix: AppLogger — consistent with rest of codebase
                    AppLogger.Error(nameof(Authenticator), ex);
                }
                finally
                {
                    // Fix: always close — was missing entirely
                    if (_connection.State == ConnectionState.Open)
                        await _connection.CloseAsync();
                }
            }

            return user;
        }

        public IUser? AuthenticateByToken(string username, string token, int UTC)
        {
            IUser? user = null;

            using (SqlCommand command = _connection.CreateCommand())
            {
                command.CommandType = CommandType.StoredProcedure;
                command.CommandText = "[dbo].[usp_Helpdesk_TokenAuthenticateSession]";

                // Fix: explicit SqlParameter — not AddWithValue implicit inference
                command.Parameters.Add(new SqlParameter("@UserLogin", SqlDbType.NVarChar) { Value = username });
                command.Parameters.Add(new SqlParameter("@UserToken", SqlDbType.NVarChar) { Value = token });
                command.Parameters.Add(new SqlParameter("@UTC", SqlDbType.Int) { Value = UTC });

                _connection.Open();
                try
                {
                    using (SqlDataReader reader = command.ExecuteReader())
                    {
                        if (reader.Read())
                            user = User.FromReader(reader);
                    }
                }
                catch (Exception ex)
                {
                    AppLogger.Error(nameof(Authenticator), ex);
                }
                finally
                {
                    if (_connection.State == ConnectionState.Open)
                        _connection.Close();
                }
            }

            return user?.UserID != null ? user : null;
        }

        public async Task<int> CheckAdmin(IUser user)
        {
            int adminLevel = 0;

            using (SqlCommand command = _connection.CreateCommand())
            {
                command.CommandType = CommandType.StoredProcedure;
                command.CommandText = "[dbo].[usp_Helpdesk_AdminAccessCheck]";
                command.Parameters.Add(new SqlParameter("@UserLogin", SqlDbType.VarChar, 255) { Value = user.UserLogin });

                try
                {
                    if (_connection.State != ConnectionState.Open)
                        await _connection.OpenAsync();

                    using (SqlDataReader reader = await command.ExecuteReaderAsync())
                    {
                        if (await reader.ReadAsync())
                            adminLevel = Convert.ToInt32(reader[0]);
                    }
                }
                catch (Exception ex)
                {
                    AppLogger.Error(nameof(Authenticator), ex);
                }
                finally
                {
                    if (_connection.State == ConnectionState.Open)
                        await _connection.CloseAsync();
                }
            }

            return adminLevel;
        }


        public async Task Logout(int userID)
        {
            using (SqlCommand command = _connection.CreateCommand())
            {
                command.CommandType = CommandType.StoredProcedure;
                command.CommandText = "[dbo].[usp_Helpdesk_DeleteSession]";
                command.Parameters.Add(new SqlParameter("@UserID", SqlDbType.Int) { Value = userID });

                await _connection.OpenAsync();
                try
                {
                    await command.ExecuteNonQueryAsync();
                }
                catch (Exception ex)
                {
                    AppLogger.Error(nameof(Authenticator), ex);
                }
                finally
                {
                    if (_connection.State == ConnectionState.Open)
                        await _connection.CloseAsync();
                }
            }
        }

        public async Task<AuthResult> SecondWallAuth(string email, int pin, int UTC)
        {
            using (SqlCommand command = _connection.CreateCommand())
            {
                command.CommandType = CommandType.StoredProcedure;
                command.CommandText = "[usp_Helpdesk_LoginPart2]";
                command.Parameters.Add(new SqlParameter("@UserName", SqlDbType.NVarChar) { Value = email });
                command.Parameters.Add(new SqlParameter("@UserPIN", SqlDbType.Int) { Value = pin });
                command.Parameters.Add(new SqlParameter("@UTC", SqlDbType.Int) { Value = UTC });

                await _connection.OpenAsync();
                try
                {
                    using (SqlDataReader reader = await command.ExecuteReaderAsync())
                    {
                        if (await reader.ReadAsync())
                        {
                            int returnCode = (int)reader["ReturnCode"];
                            string token = reader["ResponseToken"] as string ?? string.Empty;
                            DateTime? expiry = reader["ResponseExpiryTime"] as DateTime?
                                                  ?? DateTime.MinValue;

                            // Fix: typed AuthResult — not List<object>
                            if (returnCode != 0)
                                return AuthResult.Failed("Incorrect PIN.");

                            return AuthResult.Success(returnCode, token, expiry);
                        }
                    }
                }
                catch (Exception ex)
                {
                    AppLogger.Error(nameof(Authenticator), ex);
                    return AuthResult.Failed("Authentication error occurred.");
                }
                finally
                {
                    if (_connection.State == ConnectionState.Open)
                        await _connection.CloseAsync();
                }
            }

            return AuthResult.Failed("No response from authentication service.");
        }
    }
}
