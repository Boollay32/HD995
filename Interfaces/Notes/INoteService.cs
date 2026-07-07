using HelpDeskNet8.Infrastructure;
using HelpDeskNet8.Interfaces.Notes;
using HelpDeskNet8.Interfaces.Users;
using HelpDeskNet8.Requests;

namespace HelpDeskNet8.Interfaces.Notes
{
    // Single source of truth for note list + save. Both NoteController (RFC /
    // messages) and TicketDetailsController (ticket drawer) call this, so the
    // ownership check, attachment mapping, notification routing and return
    // shape live in exactly one place.
    public interface INoteService
    {
        Task<IEnumerable<INote>> GetNotes(IUser user, int ticketId);

        // Returns the refreshed note list on success, or an error string.
        Task<(bool ok, string error, IEnumerable<INote> notes)> SaveNote(
            IUser user, SaveNoteRequest request);
    }
}
