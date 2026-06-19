using System;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using HelpDeskNet8.Interfaces.Shared;
using Microsoft.AspNetCore.Mvc.Filters;

namespace HelpDeskNet8.Infrastructure
{
    // DEV ONLY: serialises any mail previews captured during the request into an
    // 'X-Mail-Preview' response header (base64 JSON) so the browser can show the
    // recipients. Registered only in Development (see Program.cs).
    public sealed class MailPreviewResultFilter : IAsyncResultFilter
    {
        private readonly IMailPreviewSink _sink;

        public MailPreviewResultFilter(IMailPreviewSink sink)
        {
            _sink = sink;
        }

        public async Task OnResultExecutionAsync(ResultExecutingContext context, ResultExecutionDelegate next)
        {
            if (_sink.Enabled && _sink.Entries.Count > 0)
            {
                string json = JsonSerializer.Serialize(
                    _sink.Entries,
                    new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
                string encoded = Convert.ToBase64String(Encoding.UTF8.GetBytes(json));
                context.HttpContext.Response.Headers["X-Mail-Preview"] = encoded;
            }

            await next();
        }
    }
}
