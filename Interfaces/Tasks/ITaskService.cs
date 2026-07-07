using HelpDeskNet8.Infrastructure;
using HelpDeskNet8.Interfaces.Tasks;
using HelpDeskNet8.Interfaces.Users;
using HelpDeskNet8.Requests;

namespace HelpDeskNet8.Interfaces.Tasks
{
    // Single source of truth for task read + save. Both TaskController (queue /
    // dashboard reads) and TicketDetailsController (ticket drawer save+read)
    // call this, so filter/attachment mapping, notification routing and the
    // return shape live in exactly one place.
    public interface ITaskService
    {
        Task<IEnumerable<ITask>> GetTasks(IUser user, IFilter filter);
        Task<IEnumerable<ITask>> GetTaskDetail(IUser user, int taskId);

        // Returns the refreshed (ticket-scoped) task list on success, or error.
        Task<(bool ok, string error, IEnumerable<ITask> tasks)> SaveTask(
            IUser user, SaveTaskRequest request);
    }
}
