using HelpDeskNet8.Infrastructure;
using HelpDeskNet8.Interfaces.Attachments;
using HelpDeskNet8.Interfaces.Notes;
using HelpDeskNet8.Interfaces.RFCs;
using HelpDeskNet8.Interfaces.Shared;
using HelpDeskNet8.Interfaces.Tasks;
using HelpDeskNet8.Interfaces.Users;
using HelpDeskNet8.Models.Shared;
using HelpDeskNet8.Requests;
using Microsoft.AspNetCore.Mvc;
using System.Collections;
using System.Data;

namespace HelpDeskNet8.Controllers.Shared
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class MiscController : ControllerBase
    {
        private readonly IAuthenticator _authenticator;
        private readonly IDropdowns _dropDownManager;
        private readonly ITaskManager _taskManager;
        private readonly IMiscManager _miscManager;

        public MiscController(
            IAuthenticator auth,
            INoteManager notesM,
            IHistory historyM,
            IAttachmentManager attachmentM,
            IRFCManager changeRequestM,
            ITaskManager taskManagerM,
            IMiscManager miscManagerM,
            IDropdowns dropDownManagerM)
        {
            _authenticator = auth;
            _dropDownManager = dropDownManagerM;
            _taskManager = taskManagerM;
            _miscManager = miscManagerM;
        }

        [HttpPost]
        public async Task<IActionResult> GetFilterItems([FromBody] GetFilterItemsRequest request)
        {
    IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();

            var filterTable = await _miscManager.GetFilterItems(request.Group);

            var result = filterTable.AsEnumerable()
                .Select(row => filterTable.Columns.Cast<DataColumn>()
                    .ToDictionary(col => col.ColumnName, col => row[col]))
                .ToList();

            return Ok(result);
        }

        [HttpPost]
        public IActionResult GetDropDownList([FromBody] GetDropDownListRequest request)
        {
    IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();

            var dropdowns = _dropDownManager.GetDropDowns(user, request.Filter, request.Group);

            if (dropdowns is not IEnumerable enumerable)
                return Ok(new Dictionary<string, List<object>>());

            var grouped = new Dictionary<string, List<object>>();

            foreach (var item in enumerable)
            {
                if (item is not DropdownListItem dropdownItem) continue;

                if (!grouped.TryGetValue(dropdownItem.Table, out var list))
                {
                    list = new List<object>();
                    grouped[dropdownItem.Table] = list;
                }

                list.Add(new
                {
                    id = dropdownItem.ID,
                    name = dropdownItem.Name,
                    text = dropdownItem.Name,
                    value = dropdownItem.ID.ToString()
                });
            }

            return Ok(grouped);
        }

        [HttpPost]
        public async Task<IActionResult> SendMailMessage([FromBody] SendMailMessageRequest request)
        {
    IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();

            string[] recipients = request.To.Split(',');
            var result = await _miscManager.SendMailMessage(request.From, recipients, request.Subject, request.Body);

            if (result[0]?.ToString() == "Error")
                return BadRequest(result);

            return Ok(result);
        }

    }
}
