using HelpDeskNet8.Controllers.Tasks;
using HelpDeskNet8.Infrastructure;
using HelpDeskNet8.Interfaces.Attachments;
using HelpDeskNet8.Interfaces.Shared;
using HelpDeskNet8.Interfaces.Tasks;
using HelpDeskNet8.Interfaces.Users;
using HelpDeskNet8.Models.Attachments;
using HelpDeskNet8.Models.Shared;
using HelpDeskNet8.Requests;

namespace HelpDeskNet8.Services
{
    public class TaskService(
        ITaskManager taskManager,
        IUserManager userManager,
        INotificationService notificationService) : ITaskService
    {
        private readonly ITaskManager _taskManager = taskManager;
        private readonly IUserManager _userManager = userManager;
        private readonly INotificationService _notificationService = notificationService;

        public async Task<IEnumerable<ITask>> GetTasks(IUser user, IFilter filter)
            => await _taskManager.GetTasks(user, filter, UTC: 0);

        public async Task<IEnumerable<ITask>> GetTaskDetail(IUser user, int taskId)
            => await _taskManager.GetTaskDetail(user, taskId);

        public async Task<(bool ok, string error, IEnumerable<ITask> tasks)> SaveTask(
            IUser user, SaveTaskRequest request)
        {
            var task = TaskMapper.Map(request.ObjectInfo);
            if (task == null)
                return (false, "Invalid task data.", Enumerable.Empty<ITask>());

            if (string.IsNullOrWhiteSpace(task.Title))
                return (false, "Task title is required.", Enumerable.Empty<ITask>());

            var attachments = MapAttachments(request.Attachments);

            task.UserID = user.UserID;

            // Detect create vs update vs status-change to route the notification.
            // Old status/assignee must be read BEFORE the save mutates them.
            bool isNewTask = !(task.TaskID.HasValue && task.TaskID.Value != 0);
            int? oldTaskStatus = null;
            string oldTaskAssignee = null;
            if (!isNewTask)
            {
                var beforeTask = (await _taskManager.GetTaskDetail(user, task.TaskID.Value)).FirstOrDefault();
                oldTaskStatus = beforeTask?.Status;
                oldTaskAssignee = beforeTask?.AssignedTech;
            }

            var result = await _taskManager.SaveTask(task, attachments, user.UserID, UTC: 0);
            if (!result.IsSuccess)
                return (false, result.Error, Enumerable.Empty<ITask>());

            // The form posts the assignee's user id as task.AssignedTech.
            int? newAssigneeId = int.TryParse(task.AssignedTech, out int parsedAssigneeId) ? parsedAssigneeId : (int?)null;

            // Change detection compares NAMES from the same source (GetTaskDetail)
            // on both sides -- never the posted id -- so re-picking the same
            // assignee does not read as a change. newAssigneeName is used only
            // for the notification wording.
            string newAssigneeName = task.AssignedTech;
            string afterAssigneeName = oldTaskAssignee;
            int? savedTaskId = result.ObjectID ?? task.TaskID;
            if (savedTaskId.HasValue && savedTaskId.Value != 0)
            {
                var savedTask = (await _taskManager.GetTaskDetail(user, savedTaskId.Value)).FirstOrDefault();
                if (savedTask != null)
                {
                    afterAssigneeName = savedTask.AssignedTech;
                    newAssigneeName = savedTask.AssignedTech;
                }
            }
            if (string.IsNullOrWhiteSpace(task.AssignedTech) && string.IsNullOrWhiteSpace(newAssigneeName))
            {
                newAssigneeName = oldTaskAssignee; // untouched assignee: unchanged
            }
            // If the "name" still parses as a number and we have the id, resolve
            // the display name from the user record (people are not robots).
            if (newAssigneeId.HasValue && int.TryParse(newAssigneeName, out _))
            {
                var assigneeUser = await _userManager.GetUserDetail(newAssigneeId.Value);
                if (!string.IsNullOrWhiteSpace(assigneeUser?.UserName))
                    newAssigneeName = assigneeUser.UserName;
            }

            var taskCtx = new NotificationContext
            {
                TaskTitle = task.Title,
                TaskID = savedTaskId,
                TaskAssigneeID = newAssigneeId,
                TaskAssigneeName = newAssigneeName,
                OldTaskAssigneeName = oldTaskAssignee,
                OldTaskStatus = oldTaskStatus,
                NewTaskStatus = task.Status,
            };
            int taskTicketId = task.TicketID ?? 0;

            if (isNewTask)
            {
                await _notificationService.Notify(taskTicketId, NotificationType.TaskCreated, user, taskCtx);
                if (!string.IsNullOrWhiteSpace(newAssigneeName))
                    await _notificationService.Notify(taskTicketId, NotificationType.TaskAssigned, user, taskCtx);
            }
            else
            {
                bool taskAssigneeChanged = !string.Equals(oldTaskAssignee ?? "", afterAssigneeName ?? "", System.StringComparison.OrdinalIgnoreCase);
                bool taskStatusChanged = oldTaskStatus != task.Status;
                if (taskAssigneeChanged)
                    await _notificationService.Notify(taskTicketId, NotificationType.TaskAssigned, user, taskCtx);
                if (taskStatusChanged)
                    await _notificationService.Notify(taskTicketId, NotificationType.TaskStatusChanged, user, taskCtx);
                if (!taskAssigneeChanged && !taskStatusChanged)
                    await _notificationService.Notify(taskTicketId, NotificationType.TaskUpdated, user, taskCtx);
            }

            var filter = new Filter { TicketID = task.TicketID };
            var tasks = await _taskManager.GetTasks(user, filter, UTC: 0);
            return (true, null, tasks);
        }

        private static IEnumerable<IAttachment> MapAttachments(
            IEnumerable<IAttachment> attachments)
        {
            if (attachments == null) return Enumerable.Empty<IAttachment>();
            return attachments
                .Where(a => !string.IsNullOrWhiteSpace(a.AttachmentByteArray))
                .Select(a => new AttachmentStub
                {
                    AttachmentByteArray = a.AttachmentByteArray,
                    AttachmentName = a.AttachmentName ?? string.Empty,
                    AttachmentImageType = a.AttachmentImageType,
                })
                .ToList();
        }
    }
}
