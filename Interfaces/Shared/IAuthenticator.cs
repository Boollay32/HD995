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

        Task<int> CheckAdmin(IUser user);
    }
}
