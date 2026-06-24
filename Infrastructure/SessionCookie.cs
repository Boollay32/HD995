using Microsoft.AspNetCore.Http;

namespace HelpDeskNet8.Infrastructure
{
    /// <summary>
    /// Single source of truth for the session-token cookie (name + options).
    /// Used by login (set), AuthenticateActionFilter (read), and logout (delete).
    /// httpOnly so XSS cannot read the token; Secure because HTTPS is enforced
    /// app-wide; SameSite=Strict is the primary CSRF control once the token
    /// stops travelling in the request body.
    /// </summary>
    public static class SessionCookie
    {
        public const string Name = "hd_session";

        /// <summary>
        /// Session cookie (no Expires) -- mirrors the current sessionStorage
        /// lifetime (cleared on browser close). Real token expiry is enforced
        /// server-side by usp_Helpdesk_TokenAuthenticateSession.
        /// </summary>
        public static CookieOptions Options() => new()
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Path = "/"
        };

        /// <summary>Clears the session cookie (matching attributes so the browser drops it).</summary>
        public static void Delete(HttpResponse response) =>
            response.Cookies.Delete(Name, new CookieOptions
            {
                Secure = true,
                SameSite = SameSiteMode.Strict,
                Path = "/"
            });
    }
}
