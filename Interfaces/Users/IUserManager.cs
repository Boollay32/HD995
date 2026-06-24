using HelpDeskNet8.Interfaces.Shared;

namespace HelpDeskNet8.Interfaces.Users
{
    public interface IUserManager
    {
        Task<IEnumerable<IUserStub>> GetUsers(IFilter filter);

        Task<IUser> GetUserDetail(int UserID);
        
        Task<string> CreateUser(String UserLogin, String FName, String SName, String Phone, Int32 Authority, Int32 Department, int UTC);

        Task<string> DeleteUser(string AdminUser, string userLogin);

        Task<String> ResetUser(String UserLogin);

        Task<String> GetUserEmailAddress(int UserID, string UserFirstName, string UserLastName, string AuthorityName);

        Task<int> UpdateUser(string UserLogin, string Phone);

        Task<string> ManageUser(string UserLogin, string AdminUserLogin, int? UnlockUser, Int32 AdminLevelID, string Phone);
    }
}
