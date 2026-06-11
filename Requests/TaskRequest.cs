using HelpDeskNet8.Interfaces.Attachments;
using HelpDeskNet8.Models.Attachments;

namespace HelpDeskNet8.Requests
{
    public class GetTasksRequest : AuthenticatedRequest
    {
        public Dictionary<string, string> Filters { get; set; }
    }

    public class GetTaskDetailRequest : AuthenticatedRequest
    {
        public int TaskId { get; set; }
    }

    public class SaveTaskRequest : AuthenticatedRequest
    {
        public string ObjectInfo { get; set; }
        // Concrete type: System.Text.Json cannot deserialize interfaces.
        // AttachmentStub's properties are the exact wire shape the client
        // sends; IEnumerable<out T> covariance keeps consumers that take
        // IEnumerable<IAttachment> working unchanged.
        public IEnumerable<AttachmentStub> Attachments { get; set; } = Enumerable.Empty<AttachmentStub>();
    }
}
