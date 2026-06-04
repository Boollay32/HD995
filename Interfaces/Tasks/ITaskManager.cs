using HelpDeskNet8.Infrastructure;
using HelpDeskNet8.Interfaces.Attachments;
using HelpDeskNet8.Interfaces.Shared;
using HelpDeskNet8.Interfaces.Users;

namespace HelpDeskNet8.Interfaces.Tasks
{
    public interface ITaskManager
    {
        public IEnumerable<ITask> GetTasks(IUser user, IFilter filter, int UTC);
        public IEnumerable<ITask> GetTaskDetail(IUser user, int taskID);
        public SaveResult SaveTask(ITask task, IEnumerable<IAttachment> attachments, int? userID, int UTC);
    }
}
