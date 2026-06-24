using HelpDeskNet8.Interfaces.Users;
using HelpDeskNet8.Models.Shared;
using System.Data;

namespace HelpDeskNet8.Interfaces.Shared
{
    public interface IDropdowns
    {
        Task<IEnumerable<DropdownListItem>> GetDropDowns(IUser user, int Filter, string Group);
        Task<DataTable> GetCustomFields(IUser user, int request);
    }
}