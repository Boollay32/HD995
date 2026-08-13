namespace HelpDeskNet8.Requests
{
    public class GetUsersRequest : AuthenticatedRequest
    {
        public Dictionary<string, string> Filters { get; set; }
    }

    public class GetUserDetailRequest : AuthenticatedRequest
    {
        public int UserId { get; set; }
    }

    public class CreateUserRequest : AuthenticatedRequest
    {
        public string UserLogin { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string Phone { get; set; }
        public int AuthorityId { get; set; }
        public int Department { get; set; }
    }

    public class UserLoginRequest : AuthenticatedRequest
    {
        public string UserLogin { get; set; }
    }

    public class UpdateUserRequest : AuthenticatedRequest
    {
        public string UserLogin { get; set; }

        // Nullable: with <Nullable>enable</Nullable> + [ApiController], a
        // non-nullable string is implicitly [Required], so a missing field
        // auto-400s before the action runs.
        public string? Phone { get; set; }
    }

    public class ManageUserRequest : AuthenticatedRequest
    {
        public string UserLogin { get; set; }

        // UnlockUser is INTENTIONALLY omitted from the payload unless an
        // unlock is requested (HD35: @UnlockUser must arrive NULL — the proc
        // unlocks on any value). These must be nullable, or implicit-required
        // validation rejects every role change / reactivate with a 400.
        public string? UnlockUser { get; set; }
        public string? AdminLevelId { get; set; }
        public string? Phone { get; set; }
    }

    public class GetUserEmailAddressRequest : AuthenticatedRequest
    {
        public int UserId { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string AuthorityName { get; set; }
    }

    public class GetAuthorityClientsRequest : AuthenticatedRequest
    {
        public int AuthorityId { get; set; }
    }
}