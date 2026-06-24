using HelpDeskNet8.Interfaces.Users;

namespace HelpDeskNet8.Interfaces.Attachments
{
    public interface IAttachmentManager
    {
        Task<IEnumerable<IAttachment>> GetAttachmentsNotes(IUser user, int TicketID, int RFC);

        Task<IEnumerable<IAttachment>> GetAttachmentsTasks(IUser user, int TicketID);

    }
}
