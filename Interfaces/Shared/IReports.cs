using System.Data;

namespace HelpDeskNet8.Interfaces.Shared
{
    public interface IReports
    {
        List<Dictionary<string, object>> GetStats(Int32 StatsID);

    }
}
