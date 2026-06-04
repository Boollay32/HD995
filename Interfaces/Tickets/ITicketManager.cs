using HelpDeskNet8.Infrastructure;
using HelpDeskNet8.Interfaces.Shared;
using HelpDeskNet8.Interfaces.Users;
using System.Data;

namespace HelpDeskNet8.Interfaces.Tickets
{
    public interface ITicketManager
    {
        IEnumerable<ITicketStub> GetTickets(IUser user, IFilter filter, Int32 myticket, int UTC);
        ITicket GetTicketDetail(int ID, IUser user);
        SaveResult SaveTicket(ITicket ticket, IUser user, int UTC, bool FalseReply, int emailSent, int visibleToClient = 1, DateTime? closeDate = null);
        DataTable GetStats(int ID, IUser user);
    }
}