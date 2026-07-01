using System.Collections.Generic;

namespace HelpDeskNet8.Interfaces.Shared
{
    // One "would-be" email captured in Development instead of being sent.
    public sealed class MailPreviewEntry
    {
        public string Point { get; set; }
        public string[] Recipients { get; set; }
        public string Subject { get; set; }
        public string Body { get; set; }
    }

    // Request-scoped collector for Development mail previews. In Production it
    // reports Enabled == false and is never written to.
    public interface IMailPreviewSink
    {
        bool Enabled { get; }
        void Add(string point, string[] recipients, string subject, string body);
        IReadOnlyList<MailPreviewEntry> Entries { get; }
    }
}
