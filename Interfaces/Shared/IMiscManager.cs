using HelpDeskNet8.Interfaces.Users;
using System.Data;

namespace HelpDeskNet8.Interfaces.Shared
{

    public interface IMiscManager
    {
        DataTable GetFilterItems(String Group);
        List<Object> SendMailMessage(string @from, string[] recepients, string subject, string body);
    }
}
