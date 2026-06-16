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

builder.Services.AddApplicationInsightsTelemetry();
builder.Services.AddSingleton<JavaScriptSnippet>();

if (!builder.Environment.IsDevelopment())
{
    builder.Services.Configure<MvcOptions>(o => o.Filters.Add(new RequireHttpsAttribute()));
}

builder.Services.AddControllersWithViews(options =>
{
    options.Filters.Add<AuthenticateActionFilter>();
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

var app = builder.Build();

app.UseCors();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();

app.Use(async (context, next) =>
{
    var headers = context.Response.Headers;
    headers["X-Content-Type-Options"] = "nosniff";
    headers["X-Frame-Options"] = "SAMEORIGIN";
    headers["Referrer-Policy"] = "strict-origin-when-cross-origin";

    // Content-Security-Policy, scoped to what the app loads. Shipped
    // REPORT-ONLY: violations are logged to the browser console but nothing
    // is blocked. Once verified clean for normal use, switch the header name
    // below to "Content-Security-Policy" (without -Report-Only) to enforce.
    headers["Content-Security-Policy-Report-Only"] =
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline'; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "img-src 'self' data:; " +
        "connect-src 'self'; " +
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
app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();
