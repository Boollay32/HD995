using HelpDeskNet8.Interfaces.Users;
using System.Data;

namespace HelpDeskNet8.Interfaces.Shared
{

    public interface IMiscManager
    {
        Task<DataTable> GetFilterItems(String Group);
        Task<List<Object>> SendMailMessage(string @from, string[] recepients, string subject, string body);
    }
}
