using HelpDeskNet8.Infrastructure;
using HelpDeskNet8.Interfaces.Attachments;
using HelpDeskNet8.Interfaces.Shared;
using HelpDeskNet8.Interfaces.Tasks;
using HelpDeskNet8.Interfaces.Users;
using HelpDeskNet8.Models.Shared;
using HelpDeskNet8.Models.Tasks;
using HelpDeskNet8.Utilities;
using Microsoft.Data.SqlClient;
using System.Data;

namespace HelpDeskNet8.Services
{
    public class TaskManager : ITaskManager
    {
        private readonly IDbConnection _connection;

        public TaskManager(IDbConnection connection)
        {
            _connection = connection;
        }

        public async Task<IEnumerable<ITask>> GetTasks(IUser user, IFilter filter, int UTC)
        {
            filter ??= new Filter();

            var taskList = new TaskList();

            var conn = (SqlConnection)_connection;
            using SqlCommand command = conn.CreateCommand();
            command.CommandType = CommandType.StoredProcedure;
            command.CommandText = "[dbo].[usp_Helpdesk_GetTasks]";

            var parameters = new Dictionary<string, (SqlDbType Type, object Value)>
            {
                { "@UserID",        (SqlDbType.Int,      user.UserID) },
                { "@MyTasks",       (SqlDbType.Int,      filter.MySearch ?? 0) },
                { "@TicketID",      (SqlDbType.Int,      filter.TicketID) },
                { "@TaskID",        (SqlDbType.Int,      filter.TaskID) },
                { "@Title",         (SqlDbType.NVarChar, filter.Title) },
                { "@RequiredByDate",(SqlDbType.Int,      filter.RequiredByDate) },
                { "@CompletionDate",(SqlDbType.Int,      filter.CompletionDate) },
                { "@CreateDate",    (SqlDbType.Int,      filter.CreateDate) },
                { "@DateFrom",      (SqlDbType.DateTime, filter.DateFrom) },
                { "@DateTo",        (SqlDbType.DateTime, filter.DateTo) },
                { "@StatusID",      (SqlDbType.Int,      filter.Status) },
                { "@Important",     (SqlDbType.Int,      filter.Important) },
                { "@AssignedTechID",(SqlDbType.Int,      filter.AssignedTechName) }
            };
            AddParameters(command, parameters);

            await conn.OpenAsync();
            try
            {
                using SqlDataReader reader = await command.ExecuteReaderAsync();

                AppLogger.Debug(nameof(TaskManager), $"FieldCount: {reader.FieldCount}");
                for (int i = 0; i < reader.FieldCount; i++)
                    AppLogger.Debug(nameof(TaskManager), $"Column[{i}]: {reader.GetName(i)}");

                while (await reader.ReadAsync())
                    if (TaskStub.FromReader(reader) is TaskStub mappedTask)
                        taskList.Add(mappedTask);

                AppLogger.Debug(nameof(TaskManager), $"Tasks returned: {taskList.Count}");
            }
            catch (Exception ex)
            {
                AppLogger.Error(nameof(TaskManager), ex);
            }
            finally
            {
                await conn.CloseAsync();
            }

            return taskList;
        }

        public async Task<IEnumerable<ITask>> GetTaskDetail(IUser user, int taskID)
        {
            var taskList = new TaskList();

            var conn = (SqlConnection)_connection;
            using SqlCommand command = conn.CreateCommand();
            command.CommandType = CommandType.StoredProcedure;
            command.CommandText = "[dbo].[usp_Helpdesk_GetTaskDetail]";
            command.Parameters.Add(new SqlParameter("@TaskID", SqlDbType.Int) { Value = taskID });
            command.Parameters.Add(new SqlParameter("@UserID", SqlDbType.Int) { Value = user.UserID });

            await conn.OpenAsync();
            try
            {
                using SqlDataReader reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                    if (TaskStub.FromReader(reader) is TaskStub mappedTask)
                        taskList.Add(mappedTask);
            }
            catch (Exception ex)
            {
                AppLogger.Error(nameof(TaskManager), ex);
            }
            finally
            {
                await conn.CloseAsync();
            }

            return taskList;
        }

        public async Task<SaveResult> SaveTask(ITask task, IEnumerable<IAttachment> attachments, int? userID, int UTC)
        {
            var conn = (SqlConnection)_connection;
            using SqlCommand command = conn.CreateCommand();
            command.CommandType = CommandType.StoredProcedure;
            command.CommandText = "[dbo].[usp_Helpdesk_ManageTask]";
            command.CommandTimeout = 60;

            var taskParameters = new Dictionary<string, (SqlDbType Type, object Value)>
            {
                { "@TaskID",        (SqlDbType.Int,      SqlValue.OrNull(task.TaskID)) },
                { "@ProgressLog",   (SqlDbType.NVarChar, SqlValue.OrNull(task.ProgressLog)) },
                { "@CompletionDate",(SqlDbType.DateTime, SqlValue.OrNull(task.Completed)) },
                { "@UTC",           (SqlDbType.Int,      UTC) },
                { "@UserID",        (SqlDbType.Int,      userID.HasValue ? (object)userID.Value : DBNull.Value) },
                { "@TicketID",      (SqlDbType.Int,      SqlValue.OrNull(task.TicketID)) },
                { "@TaskDescr",     (SqlDbType.NVarChar, SqlValue.OrNull(task.Description)) },
                { "@StatusID",      (SqlDbType.Int,      SqlValue.OrNull(task.Status)) },
                { "@Important",     (SqlDbType.Int,      task.Important == true ? 1 : 0) },
                { "@AssignedTechID",(SqlDbType.Int,      int.TryParse(task.AssignedTech, out int techId) ? techId : DBNull.Value) },
                { "@Title",         (SqlDbType.NVarChar, SqlValue.OrNull(task.Title)) },
                { "@RequiredByDate",(SqlDbType.DateTime, SqlValue.OrNull(task.RequiredDate)) }
            };
            AddParameters(command, taskParameters);

            var attachmentList = attachments.ToList();
            const int MAX_ATTACHMENTS = 5;

            for (int i = 1; i <= MAX_ATTACHMENTS; i++)
            {
                var (attachmentData, info, imageType) = GetAttachmentDetails(attachmentList, i - 1);
                var attachmentParameters = new Dictionary<string, (SqlDbType Type, object Value)>
                {
                    { $"@Attachment{i}",          (SqlDbType.VarChar, attachmentData) },
                    { $"@Attachment{i}Desc",       (SqlDbType.NVarChar,  info) },
                    { $"@Attachment{i}ImageType",  (SqlDbType.NVarChar,  imageType) }
                };
                AddParameters(command, attachmentParameters);
            }

            await conn.OpenAsync();
            try
            {
                bool isUpdate = task.TaskID.HasValue && task.TaskID != 0;

                if (isUpdate)
                {
                    await command.ExecuteNonQueryAsync();
                    return SaveResult.Updated(task.TaskID);
                }
                else
                {
                    int newTaskID = (int)await command.ExecuteScalarAsync();
                    return SaveResult.Created(newTaskID);
                }
            }
            catch (Exception ex)
            {
                AppLogger.Error(nameof(TaskManager), ex);
                return SaveResult.Failed(ex.Message);
            }
            finally
            {
                await conn.CloseAsync();
            }
        }

        // Returns the attachment as a byte[] (decoded from the base64 wire
        // string) so it binds to the @Attachment{i} VarBinary parameter.
        // A null byte[] becomes DBNull via AddParameters for empty slots.
        // The Attachment column is varchar(max): return the client's base64
        // string for storage as-is (no decode). Storing decoded bytes via a
        // VarBinary param corrupted non-text files, as SQL reinterpreted the
        // binary through the column codepage. Base64 is ASCII and safe in
        // varchar.
        private static (string Data, string Info, int ImageType) GetAttachmentDetails(List<IAttachment> attachmentList, int index)
        {
            if (attachmentList.Count <= index) return (null, "", 0);

            try
            {
                var attachment = attachmentList[index];
                string data = string.IsNullOrEmpty(attachment.AttachmentByteArray)
                    ? null
                    : attachment.AttachmentByteArray;
                return (
                    data,
                    attachment.AttachmentName,
                    (int)attachment.AttachmentImageType
                );
            }
            catch (Exception ex)
            {
                AppLogger.Error(nameof(TaskManager), ex);
                return (null, "", 0);
            }
        }

        private static void AddParameters(IDbCommand command, Dictionary<string, (SqlDbType Type, object Value)> parameterList)
        {
            foreach (var param in parameterList)
            {
                command.Parameters.Add(new SqlParameter(param.Key, param.Value.Type)
                {
                    Value = param.Value.Value ?? DBNull.Value
                });
            }
        }
    }
}
