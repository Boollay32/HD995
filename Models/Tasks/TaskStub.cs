using HelpDeskNet8.Interfaces.Attachments;
using HelpDeskNet8.Interfaces.Tasks;
using HelpDeskNet8.Models.Attachments;
using HelpDeskNet8.Utilities;
using System.Data;

namespace HelpDeskNet8.Models.Tasks
{
    public class TaskStub : ITask
    {
        public int? TaskID { get; set; }
        public int? UserID { get; set; }
        public int? TicketID { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string ProgressLog { get; set; } = string.Empty;
        public string AssignedTech { get; set; } = string.Empty;
        public int? Status { get; set; }
        public bool? Important { get; set; }
        public DateTime? RequiredDate { get; set; }
        public DateTime? Created { get; set; }
        public DateTime? Completed { get; set; }
        public IEnumerable<IAttachment> Attachments { get; set; } = new List<AttachmentModel>();

        internal static ITask FromReader(IDataReader reader)
        {
            try
            {
                var cols = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                for (int i = 0; i < reader.FieldCount; i++)
                    cols.Add(reader.GetName(i));

                object Col(string name)
                {
                    if (!cols.Contains(name)) return null;
                    object value = reader[name];
                    return value == DBNull.Value ? null : value;
                }

                return new TaskStub
                {
                    TaskID = ToInt(Col("TaskID")),
                    UserID = null,
                    TicketID = ToInt(Col("TicketID")),
                    Title = Col("Title") as string ?? string.Empty,
                    Description = Col("Description") as string ?? string.Empty,
                    AssignedTech = Col("AssignedTech") as string ?? string.Empty,
                    Status = ToInt(Col("Status") ?? Col("StatusID")),
                    Important = Col("Important") is object importantValue ? Convert.ToInt32(importantValue) == 1 : (bool?)null,
                    RequiredDate = Col("RequiredByDate") as DateTime?,
                    Created = Col("DateCreated") as DateTime?,
                    Completed = Col("CompletionDate") as DateTime?,
                    ProgressLog = Col("ProgressLog") as string ?? string.Empty,
                    Attachments = ReadAttachments(reader)
                };
            }
            catch (Exception ex)
            {
                AppLogger.Error(nameof(TaskStub), ex);
                return null;
            }
        }

        private static int? ToInt(object value)
            => value == null ? (int?)null : Convert.ToInt32(value);

        private static IEnumerable<IAttachment> ReadAttachments(IDataReader reader)
        {
            var attachments = new List<IAttachment>();

            // build column set once — no exceptions thrown
            var columns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            for (int i = 0; i < reader.FieldCount; i++)
                columns.Add(reader.GetName(i));

            for (int i = 1; i <= 5; i++)
            {
                string dataCol = $"Attachment{i}";
                string infoCol = $"AttachmentInfo{i}";
                string imageTypeCol = $"AttachmentImageType{i}";

                if (!columns.Contains(dataCol)) break; // no attachment columns in this result set

                string data = SafeGetString(reader, dataCol);
                string info = SafeGetString(reader, infoCol);
                string imageType = SafeGetString(reader, imageTypeCol);

                if (!string.IsNullOrEmpty(data))
                {
                    attachments.Add(new AttachmentModel
                    {
                        AttachmentByteArray = data,
                        AttachmentName = info ?? string.Empty,
                        AttachmentImageType = int.TryParse(imageType, out int imgType) ? imgType : 0
                    });
                }
            }

            return attachments;
        }

        private static string SafeGetString(IDataReader reader, string column)
        {
            try
            {
                int ordinal = reader.GetOrdinal(column);
                return reader.IsDBNull(ordinal) ? null : reader.GetString(ordinal);
            }
            catch (IndexOutOfRangeException)
            {
                return null;
            }
        }
    }
}
