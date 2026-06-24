using HelpDeskNet8.Infrastructure;
using HelpDeskNet8.Interfaces.Shared;
using HelpDeskNet8.Interfaces.Users;
using HelpDeskNet8.Models.Shared;
using HelpDeskNet8.Requests;
using Microsoft.AspNetCore.Mvc;

namespace HelpDeskNet8.Controllers.Login
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class LoginController(IAuthenticator auth) : ControllerBase
    {
        private readonly IAuthenticator _authenticator = auth;

        [HttpPost]
        public IActionResult PostLogin([FromBody] PostLoginRequest request)
        {
            IUser? user = _authenticator.AuthenticateByPassword(
                request.UserName, request.Password, request.UTC, request.NewPassword);

            return Ok(new TransferObject
            {
                Status = _authenticator.StatusCode,
                UserID = user?.UserID,
                AuthorityID = user?.AuthorityID
            });
        }

        [HttpPost]
        public IActionResult SecondWallAuth([FromBody] SecondWallAuthRequest request)
        {
            AuthResult result = _authenticator.SecondWallAuth(
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
    }
}
