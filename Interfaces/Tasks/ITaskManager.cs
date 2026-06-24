using HelpDeskNet8.Infrastructure;
using HelpDeskNet8.Interfaces.Attachments;
using HelpDeskNet8.Interfaces.Shared;
using HelpDeskNet8.Interfaces.Users;

namespace HelpDeskNet8.Interfaces.Tasks
{
    public interface ITaskManager
    {
        public Task<IEnumerable<ITask>> GetTasks(IUser user, IFilter filter, int UTC);
        public Task<IEnumerable<ITask>> GetTaskDetail(IUser user, int taskID);
        public Task<SaveResult> SaveTask(ITask task, IEnumerable<IAttachment> attachments, int? userID, int UTC);
    }
}
