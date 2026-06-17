// =============================  NavBar.js  ============================= //

const NavBar = {

    // -------------------------  Init  ------------------------- //

    init() {
        const nav = document.getElementById('nav');
        if (!nav) return;

        const routes = {
            'TicketsMenu': () => NavBar.tickets(),
            'TasksMenu': () => NavBar.tasks(),
            'UsersMenu': () => Nav.toUserPage(),
            'RFCMenu': () => Nav.toRFC(),
            'StatsMenu': () => NavBar.stats(),
            'ProjectsMenu': () => NavBar.projects(),
            'IncidentsMenu': () => NavBar.incidents(),
            'Logout-button': () => NavBar.startLogout(),
        };



        nav.addEventListener('click', (e) => {
            const id = e.target.closest('a')?.id;
            if (id && routes[id]) {
                e.preventDefault();
                routes[id]();
            }
        });
    },

    // -------------------------  Button Controllers  ------------------------- //

    stats() {
        Nav.toStatsPage();
    },

    projects() {
        Nav.toProjectsPage();
    },

    incidents() {
        Nav.toIncidentsPage();
    },

    tickets() {
        Nav.toTicketPage();
    },

    tasks() {
        Nav.toTasksPage();
    },


    // -------------------------  Display  ------------------------- //

    setActivePage(pageName) {
        const map = {
            'TicketPage': 'TicketsMenu',
            'TaskPage': 'TasksMenu',
            'UserPage': 'UsersMenu',
            'RFC': 'RFCMenu',
            'StatsPage': 'StatsMenu',
            'ProjectsPage': 'ProjectsMenu',
        };
        const id = map[pageName] ?? pageName;
        document.getElementById(id)?.classList.add('active');
    },

    // -------------------------  Logout  ------------------------- //

    async startLogout() {
        const ok = await Confirm.ask({
            title: 'Log out',
            message: 'Are you sure you want to log out?',
            confirmText: 'Log out',
        });
        // Same logout path as before: clear the session and reload.
        if (ok) MessageBox.okayButtonPress('Index');
    },

    // -------------------------  Z-Index  ------------------------- //

    bringForward() {
        const nav = document.getElementById('nav');
        if (nav) nav.style.zIndex = '1001';
    },

    pushBack() {
        const nav = document.getElementById('nav');
        if (nav) nav.style.zIndex = '101';
    }
};

// -------------------------  Legacy Wrappers  ------------------------- //

// -------------------------  Legacy Wrappers  ------------------------- //

function TicketsButtonController() { NavBar.tickets(); }
function TasksButtonController() { NavBar.tasks(); }
function SetActivePage(pageName) { NavBar.setActivePage(pageName); }
function StartLogout() { NavBar.startLogout(); }
function BringForwardNav() { NavBar.bringForward(); }
function PushBackNav() { NavBar.pushBack(); }

// Reveal the nav menu for users allowed on the current page (perm-restricted
// items stay hidden - toggled separately in Auth.setAdminAbilities). Was an
// undefined global that threw inside Auth.checkLimitedUserPerms.
function DisplayMenu() { const nav = document.getElementById('nav'); if (nav) nav.style.display = ''; }
