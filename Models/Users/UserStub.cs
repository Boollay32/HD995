#region HEADER
//  • GovtechHelpDesk
//   └ GovtechHelpDesk.Services
//    └ Ticket.cs
// 
// Created 16/08/2017 12:34
// Updated 21/08/2017 17:34 by Sam (Sam)
#endregion

using HelpDeskNet8.Infrastructure;
using HelpDeskNet8.Interfaces.Users;
using HelpDeskNet8.Services;
using HelpDeskNet8.Utilities;
using System.Data;


namespace HelpDeskNet8.Models.Users
{

    public class UserStub : IUserStub
    {

        public int? UserID { get; set; }

        public string UserName { get; set; }

        public string Authority { get; set; }

        public string Phone { get; set; }

        public string Email { get; set; }

        public int? Locked { get; set; }

        public DateTime? LastLoginDate { get; set; }

        public String AdminLevel { get; set; }



        internal static UserStub FromReader(IDataReader reader)
        {
            UserStub newUserStub = null;

            try
            {
                if (reader["User Name"] != DBNull.Value)
                {
                    newUserStub = new UserStub
                    {
                        // Null-safe reads throughout: the old hard casts threw
                        // on DBNull and the per-row catch swallowed it, so any
                        // user with a NULL email / authority / locked state /
                        // admin level / last login silently VANISHED from the
                        // user list (never-logged-in accounts most commonly).
                        UserID = (int?)reader["User ID"],
                        UserName = reader["User Name"] as string,
                        Phone = reader["Phone"] as string,
                        Authority = reader["Authority"] as string,
                        Email = reader["Email"] as string,
                        Locked = reader["Locked"] as int?,
                        LastLoginDate = reader["Last Login Date"] as DateTime?,
                        AdminLevel = reader["AdminLevel"] as string,
                    };
                }
            }
            catch (Exception ex)
            {
                AppLogger.Error(nameof(UserStub), ex);
            }

            return newUserStub;
        }
    }
}
