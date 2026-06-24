using HelpDeskNet8.Infrastructure;
using HelpDeskNet8.Interfaces.Projects;
using HelpDeskNet8.Interfaces.Shared;
using HelpDeskNet8.Interfaces.Users;
using HelpDeskNet8.Requests;
using Microsoft.AspNetCore.Mvc;

namespace HelpDeskNet8.Controllers.Projects
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class ProjectController(IProjectManager projectM, IAuthenticator auth) : ControllerBase
    {
        private readonly IProjectManager _projectManager = projectM;
        private readonly IAuthenticator _authenticator = auth;

        // Create / edit / complete a project is Govtech-Admin only (level 2).
        private async Task<bool> IsGovtechAdmin(IUser user) =>
            await _authenticator.CheckAdmin(user) == Constants.AdminLevel.Admin;

        [HttpPost]
        public async Task<IActionResult> GetProjects([FromBody] GetProjectsRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();

            var result = await _projectManager.GetProjects(user, request.StatusId);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> GetProjectDetail([FromBody] GetProjectDetailRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();

            var result = await _projectManager.GetProjectDetail(user, request.ProjectId);
            if (result == null) return NotFound();
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> SaveProject([FromBody] SaveProjectRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();
            if (!await IsGovtechAdmin(user)) return Forbid();

            var result = await _projectManager.SaveProject(user, request.Project);
            return Ok(result);
        }
    }
}
