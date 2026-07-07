using HelpDeskNet8.Interfaces.Shared;
using HelpDeskNet8.Models.Shared;
using HelpDeskNet8.Utilities;
using Microsoft.Data.SqlClient;
using System.Data;

namespace HelpDeskNet8.Services
{
    // ADO access for the in-app notification inbox (tblNotification). All
    // methods swallow their own exceptions after logging: a notification
    // failure must never break the originating save or page load.
    public class NotificationManager : INotificationManager
    {
        private readonly IDbConnection _connection;

        public NotificationManager(IDbConnection connection)
        {
            _connection = connection;
        }

        public async Task Write(int recipientUserId, int? actorUserId, byte eventType,
            byte entityType, int entityId, int? ticketId, string message)
        {
            var conn = (SqlConnection)_connection;
            using SqlCommand command = conn.CreateCommand();
            command.CommandType = CommandType.StoredProcedure;
            command.CommandText = "[dbo].[usp_Helpdesk_NotificationWrite]";
            command.Parameters.Add(new SqlParameter("@RecipientUserID", SqlDbType.Int) { Value = recipientUserId });
            command.Parameters.Add(new SqlParameter("@ActorUserID", SqlDbType.Int) { Value = (object)actorUserId ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@EventType", SqlDbType.TinyInt) { Value = eventType });
            command.Parameters.Add(new SqlParameter("@EntityType", SqlDbType.TinyInt) { Value = entityType });
            command.Parameters.Add(new SqlParameter("@EntityID", SqlDbType.Int) { Value = entityId });
            command.Parameters.Add(new SqlParameter("@TicketID", SqlDbType.Int) { Value = (object)ticketId ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@Message", SqlDbType.NVarChar, 400) { Value = message ?? string.Empty });

            await conn.OpenAsync();
            try
            {
                await command.ExecuteNonQueryAsync();
            }
            catch (Exception ex)
            {
                AppLogger.Error(nameof(NotificationManager), ex);
            }
            finally
            {
                await conn.CloseAsync();
            }
        }

        public async Task<(IEnumerable<NotificationStub> Notifications, int UnreadCount)> GetForUser(int userId, int top = 30)
        {
            var list = new List<NotificationStub>();
            int unread = 0;

            var conn = (SqlConnection)_connection;
            using SqlCommand command = conn.CreateCommand();
            command.CommandType = CommandType.StoredProcedure;
            command.CommandText = "[dbo].[usp_Helpdesk_NotificationGetForUser]";
            command.Parameters.Add(new SqlParameter("@UserID", SqlDbType.Int) { Value = userId });
            command.Parameters.Add(new SqlParameter("@Top", SqlDbType.Int) { Value = top });

            await conn.OpenAsync();
            try
            {
                using SqlDataReader reader = await command.ExecuteReaderAsync();

                // Result 1: the panel rows (unread first, newest first).
                while (await reader.ReadAsync())
                {
                    var stub = NotificationStub.FromReader(reader);
                    if (stub != null) list.Add(stub);
                }

                // Result 2: the badge count.
                if (await reader.NextResultAsync() && await reader.ReadAsync())
                    unread = Convert.ToInt32(reader["UnreadCount"]);
            }
            catch (Exception ex)
            {
                AppLogger.Error(nameof(NotificationManager), ex);
            }
            finally
            {
                await conn.CloseAsync();
            }

            return (list, unread);
        }

        public async Task<(int NoteUnread, int TaskUnread)> GetTicketPips(int userId, int ticketId)
        {
            var conn = (SqlConnection)_connection;
            using SqlCommand command = conn.CreateCommand();
            command.CommandType = CommandType.StoredProcedure;
            command.CommandText = "[dbo].[usp_Helpdesk_NotificationTicketPips]";
            command.Parameters.Add(new SqlParameter("@UserID", SqlDbType.Int) { Value = userId });
            command.Parameters.Add(new SqlParameter("@TicketID", SqlDbType.Int) { Value = ticketId });

            int note = 0, task = 0;
            await conn.OpenAsync();
            try
            {
                using SqlDataReader reader = await command.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    note = reader["NoteUnread"] as int? ?? 0;
                    task = reader["TaskUnread"] as int? ?? 0;
                }
            }
            catch (Exception ex)
            {
                AppLogger.Error(nameof(NotificationManager), ex);
            }
            finally
            {
                await conn.CloseAsync();
            }
            return (note, task);
        }

        public async Task MarkReadByKind(int userId, int ticketId, string kind)
        {
            var conn = (SqlConnection)_connection;
            using SqlCommand command = conn.CreateCommand();
            command.CommandType = CommandType.StoredProcedure;
            command.CommandText = "[dbo].[usp_Helpdesk_NotificationMarkReadByKind]";
            command.Parameters.Add(new SqlParameter("@UserID", SqlDbType.Int) { Value = userId });
            command.Parameters.Add(new SqlParameter("@TicketID", SqlDbType.Int) { Value = ticketId });
            command.Parameters.Add(new SqlParameter("@Kind", SqlDbType.VarChar, 8) { Value = kind ?? string.Empty });

            await conn.OpenAsync();
            try
            {
                await command.ExecuteNonQueryAsync();
            }
            catch (Exception ex)
            {
                AppLogger.Error(nameof(NotificationManager), ex);
            }
            finally
            {
                await conn.CloseAsync();
            }
        }

        public async Task PurgeRead(int userId)
        {
            var conn = (SqlConnection)_connection;
            using SqlCommand command = conn.CreateCommand();
            command.CommandType = CommandType.StoredProcedure;
            command.CommandText = "[dbo].[usp_Helpdesk_NotificationPurgeRead]";
            command.Parameters.Add(new SqlParameter("@UserID", SqlDbType.Int) { Value = userId });

            await conn.OpenAsync();
            try
            {
                await command.ExecuteNonQueryAsync();
            }
            catch (Exception ex)
            {
                // Never let a purge failure surface into the login path.
                AppLogger.Error(nameof(NotificationManager), ex);
            }
            finally
            {
                await conn.CloseAsync();
            }
        }

        public async Task MarkRead(int userId, int? notificationId)
        {
            var conn = (SqlConnection)_connection;
            using SqlCommand command = conn.CreateCommand();
            command.CommandType = CommandType.StoredProcedure;
            command.CommandText = "[dbo].[usp_Helpdesk_NotificationMarkRead]";
            command.Parameters.Add(new SqlParameter("@UserID", SqlDbType.Int) { Value = userId });
            command.Parameters.Add(new SqlParameter("@NotificationID", SqlDbType.Int) { Value = (object)notificationId ?? DBNull.Value });

            await conn.OpenAsync();
            try
            {
                await command.ExecuteNonQueryAsync();
            }
            catch (Exception ex)
            {
                AppLogger.Error(nameof(NotificationManager), ex);
            }
            finally
            {
                await conn.CloseAsync();
            }
        }
    }
}
