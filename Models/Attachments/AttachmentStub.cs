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

        internal static IAttachment FromReader(IDataReader reader)
        {
            AttachmentStub newAttachment = null;

            try
            {
                newAttachment = new AttachmentStub
                {
                    AttachmentID = (int)reader["AttachmentID"],
                    NoteID = (int)reader["NoteID"],
                    AttachmentByteArray = reader["Attachment"] is byte[] b1 ? Convert.ToBase64String(b1) : null,
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
                        AttachmentByteArray = reader["Attachment"] is byte[] b2 ? Convert.ToBase64String(b2) : null,
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
