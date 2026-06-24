using HelpDeskNet8.Infrastructure;
using HelpDeskNet8.Interfaces.Shared;
using HelpDeskNet8.Interfaces.Users;
using System.Data;

namespace HelpDeskNet8.Interfaces.Tickets
{
    public interface ITicketManager
    {
        Task<IEnumerable<ITicketStub>> GetTickets(IUser user, IFilter filter, Int32 myticket, int UTC);
        Task<IEnumerable<ITicketStub>> GetIncidents(IUser user, IFilter filter, Int32 myticket, int UTC);
        Task<ITicket> GetTicketDetail(int ID, IUser user);
        Task<SaveResult> SaveTicket(ITicket ticket, IUser user, int UTC, bool FalseReply, int emailSent, int visibleToClient = 1, DateTime? closeDate = null);
        Task<DataTable> GetStats(int ID, IUser user);
    }
}