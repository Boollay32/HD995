using System.Data;

namespace HelpDeskNet8.Interfaces.Shared
{
    public interface IReports
    {
        DataTable GetStats(Int32 StatsID);

    }
}
