using System;
using System.Collections.Generic;
using HelpDeskNet8.Interfaces.Shared;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Hosting;

namespace HelpDeskNet8.Services
{
    // Captures would-be notification emails during a request so they can be
    // shown in the browser instead of sent. Enabled only in Development.
    public sealed class MailPreviewSink : IMailPreviewSink
    {
        private readonly List<MailPreviewEntry> _entries = new List<MailPreviewEntry>();

        public bool Enabled { get; }

        public MailPreviewSink(IWebHostEnvironment env)
        {
            Enabled = env.IsDevelopment();
        }

        public void Add(string point, string[] recipients, string subject, string body)
        {
            _entries.Add(new MailPreviewEntry
            {
                Point = point,
                Recipients = recipients ?? Array.Empty<string>(),
                Subject = subject,
                Body = body,
            });
        }

        public IReadOnlyList<MailPreviewEntry> Entries => _entries;
    }
}
