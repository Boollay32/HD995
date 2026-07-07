using HelpDeskNet8.Controllers.Shared;
using HelpDeskNet8.Infrastructure;
using HelpDeskNet8.Interfaces.Attachments;
using HelpDeskNet8.Interfaces.Notes;
using HelpDeskNet8.Interfaces.Shared;
using HelpDeskNet8.Interfaces.Tickets;
using HelpDeskNet8.Interfaces.Users;
using HelpDeskNet8.Models.Attachments;
using HelpDeskNet8.Models.Shared;
using HelpDeskNet8.Requests;

namespace HelpDeskNet8.Services
{
    public class NoteService(
        INoteManager noteManager,
        ITicketManager ticketManager,
        INotificationService notificationService) : INoteService
    {
        private readonly INoteManager _noteManager = noteManager;
        private readonly ITicketManager _ticketManager = ticketManager;
        private readonly INotificationService _notificationService = notificationService;

        public async Task<IEnumerable<INote>> GetNotes(IUser user, int ticketId)
            => await _noteManager.GetNotes(user, ticketId);

        public async Task<(bool ok, string error, IEnumerable<INote> notes)> SaveNote(
            IUser user, SaveNoteRequest request)
        {
            INote note = NoteMapper.Map(request.ObjectInfo);
            if (note == null)
                return (false, "Invalid note data.", Enumerable.Empty<INote>());

            if (string.IsNullOrWhiteSpace(note.NoteDescription))
                return (false, "Note description is required.", Enumerable.Empty<INote>());

            // Editing an existing note (NoteID present): only the creator may
            // edit. Server-side ownership check -- the client hiding the edit
            // affordance for non-creators is UX only, not security. (RFC and
            // the messages pane previously skipped this entirely.)
            if (note.NoteID.HasValue && note.NoteID.Value != 0)
            {
                var existing = (await _noteManager.GetNotes(user, note.TicketID ?? 0))
                    .FirstOrDefault(n => n.NoteID == note.NoteID.Value);
                if (existing == null)
                    return (false, "Note not found.", Enumerable.Empty<INote>());
                if (existing.NotesUserID != user.UserID)
                    return (false, "You can only edit your own notes.", Enumerable.Empty<INote>());
            }

            var attachments = MapAttachments(request.Attachments);

            note.NotesUserID = user.UserID;
            note.AuthorityID = user.AuthorityID;

            var result = await _noteManager.SaveNote(
                note, attachments, user.UserID, rfc: request.RFC, UTC: request.UTC);

            if (!result.IsSuccess)
                return (false, result.Error, Enumerable.Empty<INote>());

            // Notify on a ticket reply. RFC notes are internal-only (no
            // routing). New notes only -- editing an existing note is not a
            // reply. The OPENING note (IsOriginal) is the creation description:
            // it notifies the helpdesk of a new ticket, not the originator.
            bool isNewNote = !(note.NoteID.HasValue && note.NoteID.Value != 0);
            if (!request.RFC && isNewNote)
            {
                if (request.IsOriginal)
                    await _notificationService.Notify(note.TicketID ?? 0, NotificationType.TicketCreated, user);
                else
                    await _notificationService.Notify(note.TicketID ?? 0, NotificationType.NoteResponded, user,
                        new NotificationContext { NoteVisibleToClient = note.VisibleToClient });
            }

            var notes = await _noteManager.GetNotes(user, note.TicketID ?? 0);
            return (true, null, notes);
        }

        // IDOR guard: non-Govtech callers may only act on tickets in their own
        // authority. Public so controllers can gate a bare GetNotes too.
        public async Task<bool> CannotSeeTicket(IUser user, int ticketId)
        {
            if (user.AuthorityID == Constants.Authority.Govtech) return false;
            var t = await _ticketManager.GetTicketDetail(ticketId, user);
            return t == null || t.UserAuthorityID != user.AuthorityID;
        }

        private static IEnumerable<IAttachment> MapAttachments(
            IEnumerable<IAttachment> attachments)
        {
            if (attachments == null) return Enumerable.Empty<IAttachment>();
            return attachments
                .Where(a => !string.IsNullOrWhiteSpace(a.AttachmentByteArray))
                .Select(a => new AttachmentStub
                {
                    AttachmentByteArray = a.AttachmentByteArray,
                    AttachmentName = a.AttachmentName ?? string.Empty,
                    AttachmentImageType = a.AttachmentImageType,
                })
                .ToList();
        }
    }
}
