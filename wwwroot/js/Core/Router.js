// =============================  Router.js  ============================= //

const Router = {

    _navigate(path) {
        UI.toggleWaiting();
        window.location.href = path;
    },

    toTicketPage() { Router._navigate('/TicketPage'); },
    toTasksPage() { Router._navigate('/Tasks'); },
    toProjectForm() { Router._navigate('/ProjectForm'); },
    toProjectsPage() { Router._navigate('/Projects'); },
    toIncidentsPage() { Router._navigate('/Incidents'); },
    toProjectDetail() { Router._navigate('/ProjectDetails'); },
    toCreateRFC() { Router._navigate('/CreateRFC'); },
    toCreateTicket() { Router._navigate('/CreateTicket'); },
    toRFC() { Router._navigate('/RFC'); },
    toRFCDetails() { Router._navigate('/RFCDetails'); },
    toStats() { Router._navigate('/Stats'); },
    toTicketDetails() {
        const here = window.location.pathname;
        if (here && here !== '/TicketDetails') sessionStorage.setItem('TicketListReturn', here);
        Router._navigate('/TicketDetails');
    },
    toUserPage() { Router._navigate('/UserPage'); },
    toCreateUser() { Router._navigate('/CreateUser'); },
    toStatsPage() { Router._navigate('/StatsPage'); },

    toUserDetails(username) {
        sessionStorage.setItem('ViewUserLogin', username);
        Router._navigate('/UserDetails');
    }
};

// -------------------------  Legacy Wrappers  ------------------------- //

function TicketPageView() { Router.toTicketPage(); }
function TasksPageView() { Router.toTasksPage(); }
function CreateRFCView() { Router.toCreateRFC(); }
function CreateTicketView() { Router.toCreateTicket(); }
function RFCView() { Router.toRFC(); }
function RFCDetailsView() { Router.toRFCDetails(); }
function StatsView() { Router.toStats(); }
function TicketDetailsView() { Router.toTicketDetails(); }
function UserPageView() { Router.toUserPage(); }
function StatsPageView() { Router.toStatsPage(); }
function UserDetailsView(username) { Router.toUserDetails(username); }
