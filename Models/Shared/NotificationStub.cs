using System.Data;

namespace HelpDeskNet8.Models.Shared
{
    // One in-app inbox row (tblNotification), as returned by
    // usp_Helpdesk_NotificationGetForUser. EventType mirrors the
    // NotificationType enum ordinal; EntityType: 1 ticket, 2 task, 3 RFC.
    public class NotificationStub
    {
        public int NotificationID { get; set; }
        public int? ActorUserID { get; set; }
        public byte EventType { get; set; }
        public byte EntityType { get; set; }
        public int EntityID { get; set; }
        public int? TicketID { get; set; }
        public string Message { get; set; }
        public DateTime Created { get; set; }
        public DateTime? ReadDate { get; set; }

        internal static NotificationStub FromReader(IDataReader reader)
        {
            try
            {
                if (reader["NotificationID"] == DBNull.Value) return null;

                return new NotificationStub
                {
                    NotificationID = (int)reader["NotificationID"],
                    ActorUserID = reader["ActorUserID"] as int?,
                    EventType = (byte)reader["EventType"],
                    EntityType = (byte)reader["EntityType"],
                    EntityID = (int)reader["EntityID"],
                    TicketID = reader["TicketID"] as int?,
                    Message = reader["Message"] as string ?? string.Empty,
                    Created = (DateTime)reader["Created"],
                    ReadDate = reader["ReadDate"] as DateTime?,
                };
            }
            catch
            {
                return null;
            }
        }
    }
}
