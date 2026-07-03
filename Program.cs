using HelpDeskNet8.Infrastructure;
using HelpDeskNet8.Interfaces.Attachments;
using HelpDeskNet8.Interfaces.Notes;
using HelpDeskNet8.Interfaces.Projects;
using HelpDeskNet8.Interfaces.RFCs;
using HelpDeskNet8.Interfaces.Shared;
using HelpDeskNet8.Interfaces.Tasks;
using HelpDeskNet8.Interfaces.Tickets;
using HelpDeskNet8.Interfaces.Users;
using HelpDeskNet8.Services;
using Microsoft.ApplicationInsights.AspNetCore;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.SetBasePath(Directory.GetCurrentDirectory());
builder.Configuration.AddJsonFile("appsettings.json", optional: false, reloadOnChange: true);

var connectionString = builder.Configuration.GetConnectionString("testgovtechhelpdesk");

builder.Services.AddDBConnection(connectionString);

builder.Services.AddScoped<IAuthenticator>(provider =>
    new Authenticator(connectionString));

builder.Services.AddScoped<ITicketManager, TicketManager>();
builder.Services.AddScoped<IUserManager, UserManager>();
builder.Services.AddScoped<IDropdowns, DropdownManager>();
builder.Services.AddScoped<INoteManager, NoteManager>();
builder.Services.AddScoped<IHistory, HistoryManager>();
builder.Services.AddScoped<IAttachmentManager, AttachmentManager>();
builder.Services.AddScoped<IRFCManager, RFCManager>();
builder.Services.AddScoped<IReports, ReportManager>();
builder.Services.AddScoped<ITaskManager, TaskManager>();
builder.Services.AddScoped<IProjectManager, ProjectManager>();
builder.Services.AddScoped<IMiscManager, MiscManager>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<INotificationManager, NotificationManager>();
builder.Services.AddScoped<IMailPreviewSink, MailPreviewSink>();

builder.Services.AddApplicationInsightsTelemetry();
builder.Services.AddSingleton<JavaScriptSnippet>();

// Health checks (observability 2.2): GET /healthz reports the process is up
// AND that the database is reachable (SELECT 1). Used by uptime monitors and
// the Azure health probe.
builder.Services.AddHealthChecks()
    .AddAsyncCheck("database", async () =>
    {
        try
        {
            await using var conn = new Microsoft.Data.SqlClient.SqlConnection(connectionString);
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT 1";
            await cmd.ExecuteScalarAsync();
            return Microsoft.Extensions.Diagnostics.HealthChecks.HealthCheckResult.Healthy("Database reachable");
        }
        catch (System.Exception ex)
        {
            return Microsoft.Extensions.Diagnostics.HealthChecks.HealthCheckResult.Unhealthy("Database unreachable", ex);
        }
    });

// CSRF: validate the anti-forgery token sent as a header by CSRF.js on POSTs.
builder.Services.AddAntiforgery(options => options.HeaderName = "RequestVerificationToken");

if (!builder.Environment.IsDevelopment())
{
    builder.Services.Configure<MvcOptions>(o => o.Filters.Add(new RequireHttpsAttribute()));
}

builder.Services.AddControllersWithViews(options =>
{
    options.Filters.Add<AuthenticateActionFilter>();
    // Enforce anti-forgery on all unsafe (POST/PUT/PATCH/DELETE) requests.
    options.Filters.Add(new AutoValidateAntiforgeryTokenAttribute());
    if (builder.Environment.IsDevelopment())
    {
        // DEV ONLY: surface would-be email recipients via a response header
        // instead of sending (local SMTP is unavailable). See MailPreviewSink.
        options.Filters.Add<MailPreviewResultFilter>();
    }
});
builder.Services.AddScoped<AuthenticateActionFilter>();

// CORS: allow ONLY the cross-origin hosts listed under "Cors:AllowedOrigins".
// Fails CLOSED: with none configured, no cross-origin access is granted
// (same-origin requests are unaffected). Populate the setting to open it up
// to specific hosts. Never use AllowAnyOrigin in production.
var corsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        if (corsOrigins is { Length: > 0 })
            policy.WithOrigins(corsOrigins).AllowAnyMethod().AllowAnyHeader();
        // else: no origins configured -> no cross-origin access (fail closed).
    });
});


// Rate limiting (competitive-gap 1.3): throttle the anonymous login
// endpoints (PostLogin, SecondWallAuth) per client IP to blunt brute-force
// / credential-stuffing. Limits are configurable (RateLimit:Login:*) so they
// can be tuned without a code change. Keyed by client IP -- the
// X-Forwarded-For first hop when present (Azure proxies), else the socket
// address -- so users behind a shared NAT/proxy share one bucket.
builder.Services.AddRateLimiter(options =>
{
    int permitLimit = builder.Configuration.GetValue<int?>("RateLimit:Login:PermitLimit") ?? 20;
    int windowSeconds = builder.Configuration.GetValue<int?>("RateLimit:Login:WindowSeconds") ?? 60;

    options.AddPolicy("login", httpContext =>
    {
        string forwardedFor = httpContext.Request.Headers["X-Forwarded-For"].ToString();
        string clientKey = !string.IsNullOrWhiteSpace(forwardedFor)
            ? forwardedFor.Split(',')[0].Trim()
            : (httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown");

        return RateLimitPartition.GetFixedWindowLimiter(clientKey, _ =>
            new FixedWindowRateLimiterOptions
            {
                PermitLimit = permitLimit,
                Window = TimeSpan.FromSeconds(windowSeconds),
                QueueLimit = 0
            });
    });

    // On throttle: 429 + Retry-After with a short plain-text message.
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, token) =>
    {
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out TimeSpan retryAfter))
        {
            context.HttpContext.Response.Headers["Retry-After"] =
                ((int)retryAfter.TotalSeconds).ToString(System.Globalization.CultureInfo.InvariantCulture);
        }
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        await context.HttpContext.Response.WriteAsync(
            "Too many attempts. Please wait a moment and try again.", token);
    };
});

var app = builder.Build();

app.UseCors();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();

// CSP enforcement is config-gated: false (default) ships Report-Only; true
// ships the enforcing header. Lets each environment graduate independently.
bool cspEnforce = app.Configuration.GetValue<bool>("Security:CspEnforce");

app.Use(async (context, next) =>
{
    var headers = context.Response.Headers;
    headers["X-Content-Type-Options"] = "nosniff";
    headers["X-Frame-Options"] = "SAMEORIGIN";
    headers["Referrer-Policy"] = "strict-origin-when-cross-origin";

    // Permissions-Policy (competitive-gap 1.5): deny browser features the
    // app does not use, so a compromised page can't silently invoke them.
    headers["Permissions-Policy"] =
        "accelerometer=(), autoplay=(), camera=(), display-capture=(), " +
        "encrypted-media=(), geolocation=(), gyroscope=(), magnetometer=(), " +
        "microphone=(), midi=(), payment=(), usb=()";

    // Per-request CSP nonce: lets the one remaining inline script (the
    // Application Insights snippet) execute without 'unsafe-inline'. Exposed
    // via HttpContext.Items so _Layout can stamp nonce="..." on that <script>.
    var nonceBytes = new byte[16];
    System.Security.Cryptography.RandomNumberGenerator.Fill(nonceBytes);
    var cspNonce = Convert.ToBase64String(nonceBytes);
    context.Items["csp-nonce"] = cspNonce;

    // Content-Security-Policy, scoped to what the app loads. The header name
    // is chosen by Security:CspEnforce (default false = Report-Only:
    // violations log to the console but nothing is blocked). Set it true
    // per-environment once the console is verified clean to ENFORCE; revert
    // via config if anything breaks.
    string cspHeaderName = cspEnforce
        ? "Content-Security-Policy"
        : "Content-Security-Policy-Report-Only";
    headers[cspHeaderName] =
        "default-src 'self'; " +
        "script-src 'self' 'nonce-" + cspNonce + "' https://js.monitor.azure.com; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "img-src 'self' data:; " +
        "connect-src 'self' https://*.applicationinsights.azure.com https://*.in.applicationinsights.azure.com https://*.livediagnostics.monitor.azure.com https://*.monitor.azure.com https://dc.services.visualstudio.com; " +
        "object-src 'none'; " +
        "frame-ancestors 'self'; " +
        "base-uri 'self'; " +
        "form-action 'self'";

    await next();
});

var provider = new FileExtensionContentTypeProvider();
provider.Mappings[".js"] = "application/javascript";
provider.Mappings[".mjs"] = "application/javascript";

app.UseStaticFiles(new StaticFileOptions
{
    ContentTypeProvider = provider,
    OnPrepareResponse = ctx =>
    {
        if (ctx.File.Name.EndsWith(".js", StringComparison.OrdinalIgnoreCase) ||
            ctx.File.Name.EndsWith(".mjs", StringComparison.OrdinalIgnoreCase))
        {
            ctx.Context.Response.Headers["Content-Type"] = "application/javascript; charset=utf-8";
        }

        if (app.Environment.IsDevelopment())
        {
            ctx.Context.Response.Headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
            ctx.Context.Response.Headers["Pragma"] = "no-cache";
            ctx.Context.Response.Headers["Expires"] = "0";
        }
    }
});

app.UseRouting();
app.UseRateLimiter();
app.UseAuthorization();

app.MapHealthChecks("/healthz");

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();
