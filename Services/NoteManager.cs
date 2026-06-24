using HelpDeskNet8.Interfaces.Attachments;
using HelpDeskNet8.Interfaces.Notes;
using HelpDeskNet8.Interfaces.Users;
using HelpDeskNet8.Infrastructure;
using HelpDeskNet8.Models.Notes;
using HelpDeskNet8.Utilities;
using Microsoft.Data.SqlClient;
using System.Data;

namespace HelpDeskNet8.Services
{
    public class NoteManager : INoteManager
    {
        private readonly IDbConnection _connection;

        public NoteManager(IDbConnection connection)
        {
            _connection = connection;
        }

        public async Task<IEnumerable<INote>> GetNotes(IUser user, int ticketID)
        {
            var noteList = new NoteList();

            var conn = (SqlConnection)_connection;
            using SqlCommand command = conn.CreateCommand();
            command.CommandType = CommandType.StoredProcedure;
            command.CommandText = "[dbo].[usp_Helpdesk_GetNotesDetail]";
            command.Parameters.Add(new SqlParameter("@TicketID", SqlDbType.Int) { Value = ticketID });
            command.Parameters.Add(new SqlParameter("@UserID", SqlDbType.Int) { Value = user.UserID });

            await conn.OpenAsync();
            try
            {
                using SqlDataReader reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                    noteList.Add((NoteStub)NoteStub.FromReader(reader));
            }
            catch (Exception ex)
            {
                AppLogger.Error(nameof(NoteManager), ex);
            }
            finally
            {
                await conn.CloseAsync();
            }

            return noteList;
        }

        public async Task<IEnumerable<INote>> GetRFCNotes(IUser user, int rfcID)
        {
            var noteList = new NoteList();

            var conn = (SqlConnection)_connection;
            using SqlCommand command = conn.CreateCommand();
            command.CommandType = CommandType.StoredProcedure;
            command.CommandText = "[dbo].[usp_Helpdesk_RFCGetNotesDetail]";
            command.Parameters.Add(new SqlParameter("@ChangeRequestID", SqlDbType.Int) { Value = rfcID });
            command.Parameters.Add(new SqlParameter("@UserID", SqlDbType.Int) { Value = user.UserID });

            await conn.OpenAsync();
            try
            {
                using SqlDataReader reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                    noteList.Add((NoteStub)NoteStub.FromReader(reader));
            }
            catch (Exception ex)
            {
                AppLogger.Error(nameof(NoteManager), ex);
            }
            finally
            {
                await conn.CloseAsync();
            }

            return noteList;
        }

        public async Task<SaveResult> SaveNote(INote note, IEnumerable<IAttachment> attachments, int? userID, bool rfc, int UTC)
        {
            var conn = (SqlConnection)_connection;
            using SqlCommand command = conn.CreateCommand();
            command.CommandType = CommandType.StoredProcedure;
            command.CommandTimeout = 60;

            if (rfc)
            {
                command.CommandText = "[dbo].[usp_Helpdesk_RFCManageNotes]";
                command.Parameters.Add(new SqlParameter("@ChangeRequestID", SqlDbType.Int) { Value = SqlValue.OrNull(note.RFCID) });
                command.Parameters.Add(new SqlParameter("@ChangeRequestNotesID", SqlDbType.Int) { Value = SqlValue.OrNull(note.NoteID) });
                command.Parameters.Add(new SqlParameter("@ChangeRequestNotes", SqlDbType.NVarChar) { Value = note.NoteDescription });
                command.Parameters.Add(new SqlParameter("@ChangeRequestNotesUserID", SqlDbType.Int) { Value = SqlValue.OrNull(userID) });
            }
            else
            {
                command.CommandText = "[dbo].[usp_Helpdesk_Ticket_ManageNotes]";
                command.Parameters.Add(new SqlParameter("@TicketID", SqlDbType.Int) { Value = SqlValue.OrNull(note.TicketID) });
                command.Parameters.Add(new SqlParameter("@NoteID", SqlDbType.Int) { Value = SqlValue.OrNull(note.NoteID) });
                command.Parameters.Add(new SqlParameter("@Notes", SqlDbType.NVarChar) { Value = note.NoteDescription });
                command.Parameters.Add(new SqlParameter("@UserID", SqlDbType.Int) { Value = SqlValue.OrNull(userID) });
            }

            command.Parameters.Add(new SqlParameter("@UTC", SqlDbType.Int) { Value = UTC });
            command.Parameters.Add(new SqlParameter("@VisibleToClient", SqlDbType.Bit) { Value = SqlValue.OrNull(note.VisibleToClient) });

            var attachmentList = attachments.ToList();

            for (int i = 1; i <= 5; i++)
            {
                // The Attachment column is varchar(max): store the client's
                // base64 string as-is. (Previously this decoded base64 to bytes
                // and bound a VarBinary param, so SQL reinterpreted the binary
                // through the column codepage on insert and corrupted any
                // non-text file -- PNGs etc. Base64 is ASCII and round-trips
                // through varchar cleanly.)
                object attachmentData = DBNull.Value;
                object info = DBNull.Value;
                object imageType = DBNull.Value;

                int index = i - 1;
                if (index < attachmentList.Count)
                {
                    var attachment = attachmentList[index];

                    if (!string.IsNullOrEmpty(attachment.AttachmentByteArray))
                        attachmentData = attachment.AttachmentByteArray;

                    if (!string.IsNullOrEmpty(attachment.AttachmentName))
                        info = attachment.AttachmentName;

                    imageType = attachment.AttachmentImageType.ToString();
                }

                command.Parameters.Add(new SqlParameter($"@Attachment{i}", SqlDbType.VarChar) { Value = attachmentData });
                command.Parameters.Add(new SqlParameter($"@Attachment{i}Desc", SqlDbType.NVarChar) { Value = info });
                command.Parameters.Add(new SqlParameter($"@Attachment{i}ImageType", SqlDbType.NVarChar) { Value = imageType });
            }

            await conn.OpenAsync();
            try
            {
                await command.ExecuteNonQueryAsync();
                bool isUpdate = note.NoteID.HasValue && note.NoteID != 0;
                return isUpdate ? SaveResult.Updated(note.NoteID) : SaveResult.Created(note.NoteID ?? 0);
            }
            catch (Exception ex)
            {
                AppLogger.Error(nameof(NoteManager), ex);
                return SaveResult.Failed(ex.Message);
            }
            finally
            {
                await conn.CloseAsync();
            }
        }
    }
}
