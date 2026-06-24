using HelpDeskNet8.Infrastructure;
using HelpDeskNet8.Interfaces.Users;
using HelpDeskNet8.Models.Projects;

namespace HelpDeskNet8.Interfaces.Projects
{
    public interface IProjectManager
    {
        Task<IEnumerable<IProjectStub>> GetProjects(IUser user, int? statusId);
        Task<IProject> GetProjectDetail(IUser user, int projectId);
        Task<SaveResult> SaveProject(IUser user, SaveProjectModel project);
    }
}
