using HelpDeskNet8.Controllers.Tickets;
using HelpDeskNet8.Infrastructure;
using HelpDeskNet8.Interfaces.Tasks;
using HelpDeskNet8.Interfaces.Users;
using HelpDeskNet8.Models.Shared;
using HelpDeskNet8.Requests;
using Microsoft.AspNetCore.Mvc;

namespace HelpDeskNet8.Controllers.Tasks
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class TaskController(ITaskService taskService) : ControllerBase
    {
        private readonly ITaskService _taskService = taskService;

        [HttpPost]
        public async Task<IActionResult> GetTasks([FromBody] GetTasksRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();

            Filter filter = TicketFilterMapper.Map(request.Filters);
            var result = await _taskService.GetTasks(user, filter);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> GetTaskDetail([FromBody] GetTaskDetailRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();

            var result = await _taskService.GetTaskDetail(user, request.TaskId);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> SaveTask([FromBody] SaveTaskRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();

            var (ok, error, tasks) = await _taskService.SaveTask(user, request);
            if (!ok) return BadRequest(error);
            return Ok(tasks);
        }
    }
}
