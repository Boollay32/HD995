using HelpDeskNet8.Infrastructure;
using HelpDeskNet8.Interfaces.Users;
using HelpDeskNet8.Models.Projects;

namespace HelpDeskNet8.Interfaces.Projects
{
    public interface IProjectManager
    {
        IEnumerable<IProjectStub> GetProjects(IUser user, int? statusId);
        IProject GetProjectDetail(IUser user, int projectId);
        SaveResult SaveProject(IUser user, SaveProjectModel project);
    }
}
