using HelpDeskNet8.Infrastructure;
using HelpDeskNet8.Requests;
using Microsoft.AspNetCore.Mvc;
using HelpDeskNet8.Models.Shared;
using HelpDeskNet8.Interfaces.Users;
using HelpDeskNet8.Interfaces.Shared;

namespace HelpDeskNet8.Controllers.Users
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class UserController(IAuthenticator auth, IUserManager userManager) : ControllerBase
    {
        private readonly IUserManager _userManager = userManager;
        private readonly IAuthenticator _authenticator = auth;

        // Full access (view every authority + edit) belongs to Govtech admins.
        // Admin-level legend (usp_Helpdesk_AdminAccessCheck): 0 = authority/client,
        // 1 = standard Govtech, 2 = admin, 4 = RFC-only. Level 2 is the admin tier.
        private async Task<bool> IsGovtechAdmin(IUser user) =>
            await _authenticator.CheckAdmin(user) == Constants.AdminLevel.Admin;

        // The filter a caller is allowed to use: non-admins are pinned to their own
        // authority no matter what the request asked for. Uses the existing
        // @AuthorityID parameter, so nothing about the DB call changes.
        private static Filter ScopedFilter(IUser user, bool isAdmin, IDictionary<string, string> requested)
        {
            var dict = new Dictionary<string, string>();
            if (requested != null)
            {
                foreach (var kvp in requested)
                {
                    if (kvp.Key == "null") continue;
                    dict[kvp.Key] = kvp.Value switch
                    {
                        "true" => "1",
                        "on" => "0",
                        var v => v
                    };
                }
            }

            // usp_Helpdesk_GetUsers resolves the caller's authority/access from
            // @UserID; without it the access gate matches no row and every user is
            // filtered out. Set it after the request loop so a caller cannot spoof it.
            dict["UserID"] = (user.UserID ?? 0).ToString();

            if (!isAdmin)
                dict["Authority"] = (user.AuthorityID ?? 0).ToString();

            return TypeCreator.Setup<Filter>(dict);
        }

        [HttpPost]
        public async Task<IActionResult> GetUsers([FromBody] GetUsersRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();

            return Ok(await _userManager.GetUsers(ScopedFilter(user, await IsGovtechAdmin(user), request.Filters)));
        }

        [HttpPost]
        public async Task<IActionResult> GetUserDetail([FromBody] GetUserDetailRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();

            // A non-admin may only open a user that appears in their own authority's
            // list — the same scoped query GetUsers runs — so scope is defined once.
            if (!await IsGovtechAdmin(user))
            {
                var visible = await _userManager.GetUsers(ScopedFilter(user, false, null));
                if (!visible.Any(u => u.UserID == request.UserId))
                    return StatusCode(403);
            }

            return Ok(await _userManager.GetUserDetail(request.UserId));
        }

        [HttpPost]
        public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();
            if (!await IsGovtechAdmin(user)) return StatusCode(403);

            return Ok(await _userManager.CreateUser(
                request.UserLogin, request.FirstName, request.LastName,
                request.Phone, request.AuthorityId, request.Department, request.UTC));
        }

        [HttpPost]
        public async Task<IActionResult> DeleteUser([FromBody] UserLoginRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();
            if (!await IsGovtechAdmin(user)) return StatusCode(403);

            return Ok(await _userManager.DeleteUser(user.UserLogin, request.UserLogin));
        }

        [HttpPost]
        public async Task<IActionResult> ResetUser([FromBody] UserLoginRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();
            if (!await IsGovtechAdmin(user)) return StatusCode(403);

            return Ok(await _userManager.ResetUser(request.UserLogin));
        }

        [HttpPost]
        public async Task<IActionResult> UpdateUser([FromBody] UpdateUserRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();
            if (!await IsGovtechAdmin(user)) return StatusCode(403);

            return Ok(await _userManager.UpdateUser(request.UserLogin, request.Phone));
        }

        [HttpPost]
        public async Task<IActionResult> ManageUser([FromBody] ManageUserRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();
            if (!await IsGovtechAdmin(user)) return StatusCode(403);

            // @UnlockUser must be NULL (not 0) when no unlock is intended -- the
            // proc unlocks on ANY value, including 0. HD35 locked-user fix.
            int? unlockUserInt = string.IsNullOrEmpty(request.UnlockUser) ? (int?)null : Convert.ToInt32(request.UnlockUser);
            int adminLevelIdInt = string.IsNullOrEmpty(request.AdminLevelId) ? 0 : Convert.ToInt32(request.AdminLevelId);

            return Ok(await _userManager.ManageUser(request.UserLogin, user.UserLogin, unlockUserInt, adminLevelIdInt, request.Phone));
        }

        [HttpPost]
        public async Task<IActionResult> GetUserEmailAddress([FromBody] GetUserEmailAddressRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();

            return Ok(await _userManager.GetUserEmailAddress(request.UserId, request.FirstName, request.LastName, request.AuthorityName));
        }

        // Contact-client flow: a Govtech agent picks a client authority and the
        // assigned-client dropdown is filled with that authority's users. Govtech
        // (151) may read across authorities, so the requested authority is passed
        // to usp_Helpdesk_GetUsers explicitly (the caller is not self-scoped here).
        [HttpPost]
        public async Task<IActionResult> GetAuthorityClients([FromBody] GetAuthorityClientsRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();
            if (user.AuthorityID != Constants.Authority.Govtech) return StatusCode(403);

            var dict = new Dictionary<string, string>
            {
                ["UserID"] = (user.UserID ?? 0).ToString(),
                ["Authority"] = request.AuthorityId.ToString()
            };

            return Ok(await _userManager.GetUsers(TypeCreator.Setup<Filter>(dict)));
        }
    }
}
