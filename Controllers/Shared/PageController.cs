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
        public async Task<IActionResult> TicketDetails()
        {
            // HD39: stamp the boot layout server-side so a client's Workspace is hidden
            // from first paint (no flash). Uses the same CheckAdmin the JS resolve uses,
            // so the stamped value and the JS-applied layout agree. Nothing is cached
            // client-side -- recomputed each render, so there is no editable stored value.
            IUser user = this.GetAuthenticatedUser();
            bool isClient = user != null
                && await authenticator.CheckAdmin(user) == Constants.AdminLevel.Authority;
            ViewBag.BootLayout = isClient ? "right-only" : "both";
            return View("~/Views/Page/Ticket/TicketDetails.cshtml");
        }

        [Route("Projects")]
        public IActionResult Projects() => View("~/Views/Page/Projects/ProjectsPage.cshtml");

        [Route("TicketPage")]
        public IActionResult TicketPage() => View("~/Views/Page/Ticket/TicketPage.cshtml");

        [Route("Dashboard")]
        public async Task<IActionResult> Dashboard()
        {
            // Internal landing page. Clients and RFC-only users are bounced to
            // their own home; the split mirrors Login.js enterApp so the menu,
            // the login destination, and this route always agree.
            IUser user = this.GetAuthenticatedUser();
            int level = user == null ? -1 : await authenticator.CheckAdmin(user);
            if (level == Constants.AdminLevel.Authority) return Redirect("/TicketPage");
            if (level == Constants.AdminLevel.RfcOnly) return Redirect("/RFC");
            return View("~/Views/Page/Dashboard/Dashboard.cshtml");
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
