using HelpDeskNet8.Controllers.Tickets;
using HelpDeskNet8.Infrastructure;
using HelpDeskNet8.Interfaces.Shared;
using HelpDeskNet8.Interfaces.Tasks;
using HelpDeskNet8.Interfaces.Users;
using HelpDeskNet8.Models.Shared;
using HelpDeskNet8.Requests;
using Microsoft.AspNetCore.Mvc;

namespace HelpDeskNet8.Controllers.Tasks
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class TaskController(ITaskManager taskM, IAuthenticator auth) : ControllerBase
    {
        private readonly ITaskManager _taskManager = taskM;
        private readonly IAuthenticator _authenticator = auth;

        [HttpPost]
        public async Task<IActionResult> GetTasks([FromBody] GetTasksRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();

            Filter filter = TicketFilterMapper.Map(request.Filters);
            var result = await _taskManager.GetTasks(user, filter, request.UTC);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> GetTaskDetail([FromBody] GetTaskDetailRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();

            var result = await _taskManager.GetTaskDetail(user, request.TaskId);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> SaveTask([FromBody] SaveTaskRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();

            ITask task = TaskMapper.Map(request.ObjectInfo);
            if (task == null) return BadRequest("Invalid task data.");

            SaveResult result = await _taskManager.SaveTask(task, request.Attachments, user.UserID, request.UTC);
            if (!result.IsSuccess) return BadRequest(result.Error);

            return Ok(result);
        }
    }
}
