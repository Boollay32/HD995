using HelpDeskNet8.Infrastructure;
using HelpDeskNet8.Interfaces.Shared;
using HelpDeskNet8.Interfaces.Users;
using Microsoft.AspNetCore.Mvc;

namespace HelpDeskNet8.Controllers.Shared
{
    public class PageController(IAuthenticator authenticator) : Controller
    {
        [Route("StatsPage")]
        public IActionResult StatsPage() => View("~/Views/Page/StatsPage.cshtml");

        [Route("CreateRFC")]
        public IActionResult CreateRFC() => View("~/Views/Page/RFC/CreateRFC.cshtml");

        [Route("CreateTicket")]
        public IActionResult CreateTicket() => View("~/Views/Page/Ticket/CreateTicket.cshtml");

        [Route("CreateUser")]
        public IActionResult CreateUser() => View("~/Views/Page/User/CreateUser.cshtml");

        [Route("RFC")]
        public IActionResult RFC() => View("~/Views/Page/RFC/RFCPage.cshtml");

        [Route("RFCDetails")]
        public IActionResult RFCDetails() => View("~/Views/Page/RFC/RFCDetails.cshtml");

        [Route("Stats")]
        public IActionResult Stats() => View("~/Views/Page/StatsPage.cshtml");

        [Route("ProjectDetails")]
        public IActionResult ProjectDetails() => View("~/Views/Page/Projects/ProjectDetails.cshtml");

        [Route("ProjectForm")]
        public IActionResult ProjectForm() => View("~/Views/Page/Projects/ProjectForm.cshtml");

        [Route("TicketDetails")]
        public IActionResult TicketDetails()
        {
            // HD60: clients get the full ticket view too (read-only via the JS
            // field lockdown + the server-side SaveTicket data lock), so the
            // boot layout is 'both' for everyone.
            ViewBag.BootLayout = "both";
            return View("~/Views/Page/Ticket/TicketDetails.cshtml");
        }

        [Route("Projects")]
        public IActionResult Projects() => View("~/Views/Page/Projects/ProjectsPage.cshtml");

        [Route("TicketPage")]
        public IActionResult TicketPage() => View("~/Views/Page/Ticket/TicketPage.cshtml");

        [Route("Dashboard")]
        public async Task<IActionResult> Dashboard()
        {
            // Internal landing page. FAIL-CLOSED: the Dashboard is allow-listed
            // to internal levels (StandardGovtech, Admin); every other level --
            // client, RFC-only, or anything unexpected -- is bounced to its own
            // home. The old form listed who to exclude and admitted the rest,
            // which let odd/unknown levels straight in. Mirrors Login.js enterApp.
            IUser user = this.GetAuthenticatedUser();
            int level = user == null ? -1 : await authenticator.CheckAdmin(user);
            if (level == Constants.AdminLevel.StandardGovtech || level == Constants.AdminLevel.Admin)
            {
                return View("~/Views/Page/Dashboard/Dashboard.cshtml");
            }
            return Redirect(level == Constants.AdminLevel.RfcOnly ? "/RFC" : "/TicketPage");
        }

        [Route("Incidents")]
        public IActionResult Incidents() => View("~/Views/Page/Ticket/IncidentsPage.cshtml");

        [Route("UserDetails")]
        public IActionResult UserDetails() => View("~/Views/Page/User/UserDetails.cshtml");

        [Route("UserPage")]
        public IActionResult UserPage() => View("~/Views/Page/User/UserPage.cshtml");

        [Route("Tasks")]
        public IActionResult Tasks() => View("~/Views/Page/Tasks/TasksPage.cshtml");
    }
}
