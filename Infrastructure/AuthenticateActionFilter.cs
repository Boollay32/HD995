using HelpDeskNet8.Interfaces.Shared;
using HelpDeskNet8.Interfaces.Users;
using HelpDeskNet8.Requests;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace HelpDeskNet8.Infrastructure
{
    public class AuthenticateActionFilter(IAuthenticator authenticator) : IAsyncActionFilter
    {
        private readonly IAuthenticator _authenticator = authenticator;

        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            // Skip auth for actions without AuthenticatedRequest (e.g. the login page).
            if (!context.ActionArguments.Values.OfType<AuthenticatedRequest>().Any())
            {
                await next();
                return;
            }

            var request = context.ActionArguments.Values
                .OfType<AuthenticatedRequest>()
                .First();

            // Session token comes only from the httpOnly cookie (set at login).
            string token = context.HttpContext.Request.Cookies[SessionCookie.Name] ?? string.Empty;

            IUser? user = await _authenticator.AuthenticateByToken(
                request.UserName, token, request.UTC);

            if (user == null)
            {
                context.Result = new UnauthorizedResult();
                return;
            }

            context.HttpContext.Items["AuthenticatedUser"] = user;

            await next();
        }
    }
}
