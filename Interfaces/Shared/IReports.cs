using System.Data;

namespace HelpDeskNet8.Interfaces.Shared
{
    public interface IReports
    {
        Task<List<Dictionary<string, object>>> GetStats(Int32 StatsID);

    }
}
