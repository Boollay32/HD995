// =============================  Navigation.js  ============================= //

const Nav = {

    _navigate(path) {
        UI.toggleWaiting();
        window.location.href = path;
    },

    toTicketPage() { Nav._navigate('/TicketPage'); },
    toTasksPage() { Nav._navigate('/Tasks'); },
    toProjectForm() { Nav._navigate('/ProjectForm'); },
    toProjectsPage() { Nav._navigate('/Projects'); },
    toIncidentsPage() { Nav._navigate('/Incidents'); },
    toProjectDetail() { Nav._navigate('/ProjectDetails'); },
    toCreateRFC() { Nav._navigate('/CreateRFC'); },
    toCreateTicket() { Nav._navigate('/CreateTicket'); },
    toRFC() { Nav._navigate('/RFC'); },
    toRFCDetails() { Nav._navigate('/RFCDetails'); },
    toStats() { Nav._navigate('/Stats'); },
    toTicketDetails() {
        const here = window.location.pathname;
        if (here && here !== '/TicketDetails') sessionStorage.setItem('TicketListReturn', here);
        Nav._navigate('/TicketDetails');
    },
    toUserPage() { Nav._navigate('/UserPage'); },
    toCreateUser() { Nav._navigate('/CreateUser'); },
    toStatsPage() { Nav._navigate('/StatsPage'); },
    toTaskDetails() { Nav._navigate('/TaskDetails'); },

    toUserDetails(username) {
        sessionStorage.setItem('ViewUserLogin', username);
        Nav._navigate('/UserDetails');
    }
};

// -------------------------  Legacy Wrappers  ------------------------- //

function TicketPageView() { Nav.toTicketPage(); }
function TasksPageView() { Nav.toTasksPage(); }
function CreateRFCView() { Nav.toCreateRFC(); }
function CreateTicketView() { Nav.toCreateTicket(); }
function RFCView() { Nav.toRFC(); }
function RFCDetailsView() { Nav.toRFCDetails(); }
function StatsView() { Nav.toStats(); }
function TicketDetailsView() { Nav.toTicketDetails(); }
function UserPageView() { Nav.toUserPage(); }
function StatsPageView() { Nav.toStatsPage(); }
function TaskDetailsView() { Nav.toTaskDetails(); }
function UserDetailsView(username) { Nav.toUserDetails(username); }
