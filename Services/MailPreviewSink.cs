using HelpDeskNet8.Interfaces.Shared;

namespace HelpDeskNet8.Services
{
    // Captures notification emails during a request so the browser can show
    // who was (or would have been) notified. Enabled in EVERY environment;
    // real SMTP sending is gated separately on "Mail:SendEnabled" (default
    // false -- only the live App Service sets Mail__SendEnabled = true, so
    // the test deployment can never send regardless of what is deployed).
    public sealed class MailPreviewSink : IMailPreviewSink
    {
        private readonly List<MailPreviewEntry> _entries = new List<MailPreviewEntry>();

        public bool Enabled { get; }

        public bool SendEnabled { get; }

        public MailPreviewSink(IConfiguration config)
        {
            Enabled = true;
            SendEnabled = config.GetValue<bool>("Mail:SendEnabled", false);
        }

        public void Add(string point, string[] recipients, string subject, string body, bool sent)
        {
            _entries.Add(new MailPreviewEntry
            {
                Point = point,
                Recipients = recipients ?? Array.Empty<string>(),
                Subject = subject,
                Body = body,
                Sent = sent,
            });
        }

        public IReadOnlyList<MailPreviewEntry> Entries => _entries;
    }
}