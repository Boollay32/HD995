using HelpDeskNet8.Interfaces.Attachments;
using HelpDeskNet8.Interfaces.Users;
using HelpDeskNet8.Infrastructure;

namespace HelpDeskNet8.Interfaces.Notes
{
    public interface INoteManager
    {
        Task<IEnumerable<INote>> GetNotes(IUser user, int ticketID);
        Task<IEnumerable<INote>> GetRFCNotes(IUser user, int rfcID);
        Task<SaveResult> SaveNote(INote note, IEnumerable<IAttachment> attachments, int? userID, bool rfc, int UTC);
    }
}
