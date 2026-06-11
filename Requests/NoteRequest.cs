using HelpDeskNet8.Interfaces.Attachments;
using HelpDeskNet8.Models.Attachments;

namespace HelpDeskNet8.Requests
{
    public class GetNotesRequest : AuthenticatedRequest
    {
        public int TicketId { get; set; }
    }

    public class SaveNoteRequest : AuthenticatedRequest
    {
        public string ObjectInfo { get; set; }
        // Concrete type: System.Text.Json cannot deserialize interfaces.
        // AttachmentStub's properties are the exact wire shape the client
        // sends; IEnumerable<out T> covariance keeps consumers that take
        // IEnumerable<IAttachment> working unchanged.
        public IEnumerable<AttachmentStub> Attachments { get; set; } = Enumerable.Empty<AttachmentStub>();
        public bool RFC { get; set; }
    }

    public class GetRFCNotesRequest : AuthenticatedRequest
    {
        public int RFCId { get; set; }
    }
}
