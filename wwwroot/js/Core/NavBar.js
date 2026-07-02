// =============================  NavBar.js  ============================= //

const NavBar = {

    // -------------------------  Init  ------------------------- //

    init() {
        const nav = document.getElementById('nav');
        if (!nav) return;

        const routes = {
            'DashboardMenu': () => Router.toDashboard(),
            'TicketsMenu': () => NavBar.tickets(),
            'TasksMenu': () => NavBar.tasks(),
            'UsersMenu': () => Router.toUserPage(),
            'RFCMenu': () => Router.toRFC(),
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

        NavBar._setupIndicator();
    },

    // -------------------------  Button Controllers  ------------------------- //

    stats() {
        Router.toStatsPage();
    },

    projects() {
        Router.toProjectsPage();
    },

    incidents() {
        Router.toIncidentsPage();
    },

    tickets() {
        Router.toTicketPage();
    },

    tasks() {
        Router.toTasksPage();
    },


    // -------------------------  Display  ------------------------- //

    _ind: null,

    _setupIndicator() {
        const menu = document.getElementById('navbar-menu');
        if (!menu || menu.querySelector('.nav-ind')) return;
        const ind = document.createElement('span');
        ind.className = 'nav-ind';
        ind.setAttribute('aria-hidden', 'true');
        menu.appendChild(ind);
        NavBar._ind = ind;

        menu.addEventListener('mouseover', (e) => {
            const a = e.target.closest('a');
            if (a && a.parentElement === menu) NavBar._moveInd(a);
        });
        menu.addEventListener('mouseleave', () => NavBar._moveInd(menu.querySelector('a.active')));
        window.addEventListener('resize', () => NavBar._moveInd(menu.querySelector('a.active')));
        requestAnimationFrame(() => NavBar._moveInd(menu.querySelector('a.active')));
    },

    _moveInd(el) {
        const ind = NavBar._ind;
        if (!ind) return;
        if (!el) { ind.style.width = '0px'; ind.style.opacity = '0'; return; }
        ind.style.left = el.offsetLeft + 'px';
        ind.style.width = el.offsetWidth + 'px';
        ind.style.opacity = '1';
    },

    setActivePage(pageName) {
        const map = {
            'Dashboard': 'DashboardMenu',
            'TicketPage': 'TicketsMenu',
            'TaskPage': 'TasksMenu',
            'UserPage': 'UsersMenu',
            'RFC': 'RFCMenu',
            'StatsPage': 'StatsMenu',
            'ProjectsPage': 'ProjectsMenu',
        };
        const id = map[pageName] ?? pageName;
        document.getElementById(id)?.classList.add('active');
        NavBar._moveInd(document.getElementById('navbar-menu')?.querySelector('a.active'));
    },

    // -------------------------  Logout  ------------------------- //

    async startLogout() {
        const ok = await Confirm.ask({
            title: 'Log out',
            message: 'Are you sure you want to log out?',
            confirmText: 'Log out',
        });
        if (!ok) return;
        // Tell the server to end the DB session and clear the httpOnly cookie,
        // then clear client state and reload. Best-effort: a dead session just 401s.
        try {
            await fetch('/api/Login/Logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(API.authPayload())
            });
        } catch { /* ignore -- log out client-side regardless */ }
        MessageBox.okayButtonPress('Index');
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

// Self-initialise on DOM ready (moved out of the _Layout inline
// <script> so script-src can later drop 'unsafe-inline').
document.addEventListener('DOMContentLoaded', () => NavBar.init());
