namespace HelpDeskNet8.Interfaces.Shared
{
    // One email captured for the in-browser "who was notified" popup.
    // Sent records whether the real SMTP send also happened (live) or
    // sending is disabled (dev / test deployment).
    public sealed class MailPreviewEntry
    {
        public string Point { get; set; }
        public string[] Recipients { get; set; }
        public string Subject { get; set; }
        public string Body { get; set; }
        public bool Sent { get; set; }
    }

    // Request-scoped collector for the mail popup -- now enabled in EVERY
    // environment. SendEnabled is the single switch for real SMTP sends
    // ("Mail:SendEnabled", default false: only live sets it true).
    public interface IMailPreviewSink
    {
        bool Enabled { get; }
        bool SendEnabled { get; }

        void Add(string point, string[] recipients, string subject, string body, bool sent);

        IReadOnlyList<MailPreviewEntry> Entries { get; }
    }
}