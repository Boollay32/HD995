using HelpDeskNet8.Infrastructure;
using HelpDeskNet8.Interfaces.RFCs;
using HelpDeskNet8.Interfaces.Shared;
using HelpDeskNet8.Interfaces.Users;
using HelpDeskNet8.Models.RFCs;
using HelpDeskNet8.Models.Shared;
using HelpDeskNet8.Requests;
using Microsoft.AspNetCore.Mvc;
using System.Reflection;

namespace HelpDeskNet8.Controllers
{
    [ApiController]
    [Route("api/[controller]/[action]")]
    public class RFCController(IRFCManager changeRequestM, IAuthenticator auth, INotificationService notificationService) : ControllerBase
    {
        private readonly IRFCManager _changeRequestManager = changeRequestM;
        private readonly IAuthenticator _authenticator = auth;
        private readonly INotificationService _notificationService = notificationService;

        // RFCs are internal-only. External authority users
        // (AdminLevel.Authority) must not access any RFC endpoint.
        private async Task<bool> IsInternal(IUser user) =>
            await _authenticator.CheckAdmin(user) != Constants.AdminLevel.Authority;

        [HttpPost]
        public async Task<IActionResult> GetRFCs([FromBody] GetRFCsRequest request)
        {
            IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();
            if (!await IsInternal(user)) return StatusCode(403);

            var filterDict = new Dictionary<string, string>();
            if (request.Filters != null)
            {
                foreach (var kvp in request.Filters)
                {
                    string key = char.ToUpper(kvp.Key[0]) + kvp.Key.Substring(1);
                    if (key != "null") filterDict[key] = kvp.Value;
                }
            }

            Filter filter = TypeCreator.Setup<Filter>(filterDict);
            var result = await _changeRequestManager.GetRFCs(user.UserID, filter);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> GetRFCDetail([FromBody] GetRFCDetailRequest request)
        {
    IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();
            if (!await IsInternal(user)) return StatusCode(403);

            var result = await _changeRequestManager.GetRFCDetail(request.RFCId);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> SaveRFC([FromBody] SaveRFCRequest request)
        {
    IUser user = this.GetAuthenticatedUser();
            if (user == null) return Unauthorized();
            if (!await IsInternal(user)) return StatusCode(403);

            var rfcBuild = new Dictionary<string, string>();
            rfcBuild.Add("ChangeRequestID", request.RFCId.ToString());

            foreach (var pair in request.ObjectInfo.Split('|'))
            {
                var set = pair.Split('`');
                string key = set[0];
                if (string.IsNullOrEmpty(key)) continue;
                if (key.Contains("-Day")) key = key.Replace("-Day", "");
                try { rfcBuild.Add(key, set[1]); }
                catch (ArgumentException) { }
            }

            IRFC rfc = new RFC();
            PopulateObject(rfc, rfcBuild);

            // Capture the RFC's current status before the save so a status move can
            // be told from a plain update for the notification.
            string oldRfcStatus = null;
            if (rfc.ChangeRequestID != 0)
            {
                IRFC beforeRfc = await _changeRequestManager.GetRFCDetail(rfc.ChangeRequestID);
                oldRfcStatus = beforeRfc?.Status;
            }

            List<object> result = rfc.ChangeRequestID != 0
                ? await _changeRequestManager.SaveRFC((int)user.UserID, rfc.GetChanges(), request.UTC)
                : await _changeRequestManager.SaveRFC((int)user.UserID, rfc, request.UTC);

            if (result[0]?.ToString() == "Error") return BadRequest(result);

            // Notify: a new RFC -> Assigned (the new tech); an existing RFC ->
            // StatusChanged when the status moved, otherwise Responded (update).
            if (result.Count > 1 && int.TryParse(result[1]?.ToString(), out int savedRfcId))
            {
                if (result[0]?.ToString() == "Created")
                {
                    await _notificationService.NotifyRFC(savedRfcId, NotificationType.RFCAssigned, user);
                }
                else
                {
                    bool rfcStatusChanged = !string.Equals(oldRfcStatus ?? "", rfc.Status ?? "", System.StringComparison.OrdinalIgnoreCase);
                    NotificationType rfcType = rfcStatusChanged
                        ? NotificationType.RFCStatusChanged
                        : NotificationType.RFCResponded;
                    await _notificationService.NotifyRFC(savedRfcId, rfcType, user,
                        new NotificationContext { OldStatus = oldRfcStatus, NewStatus = rfc.Status });
                }
            }

            return Ok(result);
        }

        private void PopulateObject<T>(T obj, Dictionary<string, string> data)
        {
            foreach (var item in data)
            {
                if (string.IsNullOrEmpty(item.Value)) continue;
                try
                {
                    string key = char.ToUpper(item.Key[0]) + item.Key.Substring(1);
                    PropertyInfo prop = obj.GetType().GetProperty(key, BindingFlags.Public | BindingFlags.Instance);
                    string typeName = prop.PropertyType.ToString();
                    if (typeName.Contains("DateTime"))
                        prop.SetValue(obj, DateTime.Parse(item.Value), null);
                    else if (typeName.Contains("Int"))
                        prop.SetValue(obj, Convert.ToInt32(item.Value), null);
                    else if (typeName.Contains("String"))
                        prop.SetValue(obj, item.Value, null);
                }
                catch { }
            }
        }
    }
}
