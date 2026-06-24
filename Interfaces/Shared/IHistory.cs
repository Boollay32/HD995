using HelpDeskNet8.Interfaces.Users;

namespace HelpDeskNet8.Interfaces.Shared
{
    public interface IHistory
    {
        Task<object> GetHistory(IUser user, int TicketID);
    }
}