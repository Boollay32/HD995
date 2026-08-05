using HelpDeskNet8.Infrastructure;
using HelpDeskNet8.Interfaces.Shared;
using HelpDeskNet8.Interfaces.Users;
using HelpDeskNet8.Models.Shared;
using HelpDeskNet8.Requests;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace HelpDeskNet8.Controllers.Login
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class LoginController(IAuthenticator auth, INotificationManager notificationManager,
        IMiscManager miscManager, IMailPreviewSink mailPreview) : ControllerBase
    {
        private readonly IAuthenticator _authenticator = auth;
        private readonly INotificationManager _notificationManager = notificationManager;
        private readonly IMiscManager _miscManager = miscManager;
        private readonly IMailPreviewSink _mailPreview = mailPreview;

        [HttpPost]
        [EnableRateLimiting("login")]
        [IgnoreAntiforgeryToken] // pre-auth login step; CSRF here is low-value, exemption avoids lockout risk
        public async Task<IActionResult> PostLogin([FromBody] PostLoginRequest request)
        {
            IUser? user = await _authenticator.AuthenticateByPassword(
                request.UserName, request.Password, request.UTC, request.NewPassword);

            // Read notifications live only for the session they were read in:
            // a new login sweeps them. Fire-safe -- PurgeRead swallows its own
            // errors, so this can never block a login.
            if (user?.UserID != null)
            {
                await _notificationManager.PurgeRead(user.UserID.Value);
            }

            return Ok(new TransferObject
            {
                Status = _authenticator.StatusCode,
                UserID = user?.UserID,
                AuthorityID = user?.AuthorityID,
                DisplayName = user?.UserName
            });
        }

        [HttpPost]
        [EnableRateLimiting("login")]
        [IgnoreAntiforgeryToken] // pre-auth login step (see PostLogin)
        public async Task<IActionResult> SecondWallAuth([FromBody] SecondWallAuthRequest request)
        {
            AuthResult result = await _authenticator.SecondWallAuth(
                request.Email, request.Pin, request.UTC);

            if (result.IsSuccess && !string.IsNullOrEmpty(result.Token))
            {
                // Phase A: also issue the session token as an httpOnly cookie.
                // The body token is still returned (dual transport); the auth
                // filter prefers the cookie and falls back to the body.
                Response.Cookies.Append(SessionCookie.Name, result.Token, SessionCookie.Options());
            }

            return result.IsSuccess ? Ok(result) : Unauthorized(result.Error);
        }

        // Self-service password reset. Username + PIN are the possession
        // factor; the PIN itself is NEVER reset here (manual support action
        // only). Anti-enumeration: the response is byte-identical whether or
        // not the details matched, and the temp password is emailed - never
        // returned to the browser. Wrong-PIN attempts are counted by the
        // proc: 5 strikes locks the account.
        private const string ResetFromAddress = "govtech.helpdesk@govtech.co.uk";

        [HttpPost]
        [EnableRateLimiting("login")]
        [IgnoreAntiforgeryToken] // pre-auth login step (see PostLogin)
        public async Task<IActionResult> RequestPasswordReset([FromBody] PasswordResetRequest request)
        {
            try
            {
                (int code, string? temp) = await _authenticator.RequestPasswordReset(
                    request.UserName?.Trim() ?? string.Empty, request.Pin);

                if (code == 0 && !string.IsNullOrEmpty(temp))
                {
                    string subject = "Govtech Helpdesk - your temporary password";
                    string body =
                        "<p>A password reset was requested for your Govtech Helpdesk account.</p>" +
                        "<p>Your temporary password is: <b>" + temp + "</b></p>" +
                        "<p>Sign in with it and you will be asked to choose a new password. " +
                        "Your PIN has not changed.</p>" +
                        "<p>If you did not request this, contact Govtech support immediately.</p>";

                    if (_mailPreview.Enabled)
                        _mailPreview.Add("PasswordReset", new[] { request.UserName }, subject, body);
                    else
                        await _miscManager.SendMailMessage(ResetFromAddress, new[] { request.UserName }, subject, body);
                }
            }
            catch (Exception ex)
            {
                AppLogger.Error(nameof(LoginController), ex);
            }

            // Always the same answer, matched or not.
            return Ok(new { message = "If the details match an account, an email with a temporary password has been sent." });
        }

        [HttpPost]
        public IActionResult Logout([FromBody] AuthenticatedRequest request)
        {
            // Cookie-only logout: clear the session cookie. The DB session row
            // expires on its own, and the cleared httpOnly cookie prevents reuse.
            SessionCookie.Delete(Response);
            return Ok();
        }
    }
}
