#region HEADER

//  • GovtechHelpDesk
//   └ GovtechHelpDesk.Services
//    └ Ticket.cs
//
// Created 16/08/2017 12:34
// Updated 21/08/2017 17:34 by Sam (Sam)

#endregion

using HelpDeskNet8.Interfaces.Tickets;
using HelpDeskNet8.Utilities;
using System.Data;

namespace HelpDeskNet8.Models.Tickets
{
    //[KnownType(typeof(IEnumerable<TicketStub>))]
    public class TicketStub : ITicketStub
    {
        public int? TicketID { get; set; }

        public DateTime? Created { get; set; }

        public DateTime? Updated { get; set; }

        public string RequestType { get; set; }

        public string Subject { get; set; }

        public string Notes { get; set; }

        public string UserName { get; set; }

        // Unique originator key for the "My open" filter; null when the
        // proc does not (yet) return an id column for the client.
        public int? UserID { get; set; }

        public string StatusDesc { get; set; }

        public string Status { get; set; }

        public string AssignedTech { get; set; }
        public int? AssignedTechID { get; set; }

        public string Authority { get; set; }

        public string Priority { get; set; }

        public string Notify { get; set; }

        public DateTime? TargetDate { get; set; }

        // Tolerant optional-int read: the queue procs may not (yet) return
        // these columns; absence means null rather than a thrown row.
        private static int? TicketColInt(IDataReader reader, string name)
        {
            for (int i = 0; i < reader.FieldCount; i++)
                if (string.Equals(reader.GetName(i), name, StringComparison.OrdinalIgnoreCase))
                    return reader[i] == DBNull.Value ? (int?)null : Convert.ToInt32(reader[i]);
            return null;
        }

        internal static TicketStub FromReader(IDataReader reader)
        {
            TicketStub newTicketStub = null;

            try
            {
                if (reader["TicketID"] != DBNull.Value)
                {
                    newTicketStub = new TicketStub
                    {
                        TicketID = (int)reader["TicketID"],
                        Created = (DateTime?)reader["CreateDate"],
                        Updated = (DateTime?)reader["LastUpdateDate"],
                        RequestType = (string)reader["RequestDesc"],
                        Subject = (string)reader["TicketSubject"],
                        Notes = (string)reader["Notes"],
                        UserName = (string)reader["Client"],
                        UserID = TicketColInt(reader, "UserID") ?? TicketColInt(reader, "ClientID"),
                        Status = (string)reader["StatusDesc"],
                        AssignedTech = reader["Assigned Tech"] is DBNull ? String.Empty : (string)reader["Assigned Tech"],
                        AssignedTechID = reader["AssignedTechID"] as int?,
                        Authority = (string)reader["AuthorityAbbr"],
                        Priority = (string)reader["PriorityDesc"],
                        // Guarded like AssignedTech above: a ticket that has never
                        // gone through any notify-setting code path stores NULL here,
                        // and (string)DBNull.Value throws -- which previously killed
                        // this entire row (caught below, FromReader returns null, and
                        // TicketManager still adds it to the list -- crashing every
                        // queue-side filter/render that dereferences it). '2' = no
                        // active notification, matching NULL's real meaning.
                        Notify = reader["Notify"] is DBNull ? "2" : (string)reader["Notify"],
                        // Not every ticket read returns TargetDate (the CR pool proc
                        // removes it): reading a missing column throws, the catch
                        // nulls the whole row, and the queue crashes downstream.
                        TargetDate = Enumerable.Range(0, reader.FieldCount).Any(i => reader.GetName(i) == "TargetDate")
                            ? reader["TargetDate"] as DateTime?
                            : null
                    };
                }
            }
            catch (Exception ex)
            {
                AppLogger.Error(nameof(TicketStub), ex);
            }

            return newTicketStub;
        }
    }
}