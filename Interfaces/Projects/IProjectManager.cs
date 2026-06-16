using HelpDeskNet8.Interfaces.Users;

namespace HelpDeskNet8.Interfaces.Projects
{
    public interface IProjectManager
    {
        IEnumerable<IProjectStub> GetProjects(IUser user, int? statusId);
        IProject GetProjectDetail(IUser user, int projectId);
    }
}
