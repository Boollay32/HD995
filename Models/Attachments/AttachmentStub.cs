using HelpDeskNet8.Interfaces.Attachments;
using HelpDeskNet8.Utilities;
using System;
using System.Data;


namespace HelpDeskNet8.Models.Attachments
{

    public class AttachmentStub : IAttachment
    {        
        public int AttachmentID { get; set; }        
        public int NoteID { get; set; }        
        public int TaskID { get; set; }        
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
            // The Attachment column is varchar(max) holding the base64 string
            // exactly as it was stored, so return it as-is. (A byte[] branch is
            // kept only in case a driver/provider ever surfaces the text column
            // as bytes; legacy pre-fix rows that stored raw file text instead of
            // base64 are recovered via Latin1 so they still open.)
            if (value is string s)
            {
                if (string.IsNullOrEmpty(s)) return null;
                // Base64 payloads are pure ASCII (A-Z a-z 0-9 + / =, optional
                // whitespace). If it looks like base64 it already is -- return
                // it. Otherwise it's a legacy raw-text row: recover its bytes.
                string trimmed = s.Trim();
                if (trimmed.Length > 0 &&
                    System.Text.RegularExpressions.Regex.IsMatch(
                        trimmed, "^[A-Za-z0-9+/\\r\\n\\t ]+={0,2}$"))
                    return trimmed;
                return System.Convert.ToBase64String(System.Text.Encoding.Latin1.GetBytes(s));
            }
            if (value is byte[] bytes) return bytes.Length > 0 ? System.Convert.ToBase64String(bytes) : null;
            try { return System.Convert.ToBase64String((byte[])value); }
            catch { return null; }
        }

        // Returns true if the reader exposes a column with the given name
        // (case-insensitive). Used to pick NoteID vs TaskID without relying on
        // exception-driven control flow, which is fragile on a forward-only
        // reader and was throwing IndexOutOfRangeException for task attachments.
        private static bool HasColumn(IDataReader reader, string name)
        {
            for (int i = 0; i < reader.FieldCount; i++)
            {
                if (string.Equals(reader.GetName(i), name, StringComparison.OrdinalIgnoreCase))
                    return true;
            }
            return false;
        }

        internal static IAttachment FromReader(IDataReader reader)
        {
            try
            {
                // Note attachments expose a NoteID column; task attachments a
                // TaskID column. Populate the MATCHING stub property so the wire
                // item carries the right key (noteID for notes, taskID for
                // tasks) -- the client groups task attachments by taskID, which
                // was previously undefined because the id was mislabelled as
                // noteID, so every task attachment was silently dropped.
                bool hasNote = HasColumn(reader, "NoteID");
                int ownerId = hasNote ? (int)reader["NoteID"] : (int)reader["TaskID"];

                return new AttachmentStub
                {
                    AttachmentID = (int)reader["AttachmentID"],
                    NoteID = hasNote ? ownerId : 0,
                    TaskID = hasNote ? 0 : ownerId,
                    AttachmentByteArray = ToBase64(reader["Attachment"]),
                    AttachmentDate = (DateTime)reader["AttachmentDate"],
                    AttachmentName = (string)reader["AttachmentInfo"],
                    AttachmentImageType = (int)reader["AttachmentImageType"],
                };
            }
            catch (Exception ex)
            {
                AppLogger.Error(nameof(Attachments), ex);
                return null;
            }
        }
    }
}
