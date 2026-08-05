using HelpDeskNet8.Infrastructure;
using HelpDeskNet8.Interfaces.Users;

namespace HelpDeskNet8.Interfaces.Shared
{
    public interface IAuthenticator
    {
        int StatusCode { get; }
        string? StatusText { get; }

        // Fix: nullable return — null = auth failed
        Task<IUser?> AuthenticateByPassword(string username, string password,
            int UTC, string? newPassword = null);

        // Fix: nullable return — null = token invalid/expired
        Task<IUser?> AuthenticateByToken(string username, string token, int UTC);

        // Fix: AuthResult — strongly typed — replaces List<object>
        Task<AuthResult> SecondWallAuth(string email, int pin, int UTC);

        // Self-service password reset: verifies the PIN and, if correct,
        // resets the PASSWORD ONLY (temp emailed by the caller). Returns
        // (proc return code, temp password or null). The PIN never changes
        // here - PIN resets are a manual Govtech support action.
        Task<(int Code, string? TempPassword)> RequestPasswordReset(string username, int pin);

        Task<int> CheckAdmin(IUser user);
    }
}
