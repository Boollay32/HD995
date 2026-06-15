using HelpDeskNet8.Interfaces.Attachments;
using HelpDeskNet8.Utilities;
using System.Data;


namespace HelpDeskNet8.Models.Attachments
{

    public class AttachmentStub : IAttachment
    {        
        public int AttachmentID { get; set; }        
        public int NoteID { get; set; }        
        public String AttachmentByteArray { get; set; }        
        public String AttachmentName { get; set; }        
        public int AttachmentImageType { get; set; }        
        public DateTime? AttachmentDate { get; set; }

        // Defensively convert the Attachment column to base64 regardless of how
        // the driver surfaces it: byte[], an already-base64 string, DBNull/null,
        // or another binary shape. Returns null only when there is no data.
        private static string ToBase64(object value)
        {
            if (value == null || value is System.DBNull) return null;
            if (value is byte[] bytes) return bytes.Length > 0 ? System.Convert.ToBase64String(bytes) : null;
            if (value is string s)
            {
                // A string here is raw bytes surfaced as text, not base64.
                // Latin1 maps each char 1:1 to a byte, recovering the
                // original bytes; base64-encode those for the client.
                if (string.IsNullOrEmpty(s)) return null;
                return System.Convert.ToBase64String(System.Text.Encoding.Latin1.GetBytes(s));
            }
            try { return System.Convert.ToBase64String((byte[])value); }
            catch { return null; }
        }

        internal static IAttachment FromReader(IDataReader reader)
        {
            AttachmentStub newAttachment = null;

            try
            {
                newAttachment = new AttachmentStub
                {
                    AttachmentID = (int)reader["AttachmentID"],
                    NoteID = (int)reader["NoteID"],
                    AttachmentByteArray = ToBase64(reader["Attachment"]),
                    AttachmentDate = (DateTime)reader["AttachmentDate"],
                    AttachmentName = (string)reader["AttachmentInfo"],
                    AttachmentImageType = (int)reader["AttachmentImageType"],

                };

            }
            catch (Exception EX)
            {
                try
                {
                    newAttachment = new AttachmentStub
                    {
                        AttachmentID = (int)reader["AttachmentID"],
                        NoteID = (int)reader["TaskID"],
                        AttachmentByteArray = ToBase64(reader["Attachment"]),
                        AttachmentDate = (DateTime)reader["AttachmentDate"],
                        AttachmentName = (string)reader["AttachmentInfo"],
                        AttachmentImageType = (int)reader["AttachmentImageType"],

                    };
                }
                catch (Exception ex)
                {
                    AppLogger.Error(nameof(Attachments), ex);
                }
            }


            return newAttachment;
        }
    }
}
