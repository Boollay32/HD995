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
            'AdminMenu': () => NavBar.adminPage('LoginMsg'),
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

    adminPage(subPage) {
        UI.toggleWaiting();
        Auth.checkLimitedGovtechUserPerms();
        Nav.toAdminPage();
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
            'AdminPage': 'AdminMenu',
        };
        const id = map[pageName] ?? pageName;
        document.getElementById(id)?.classList.add('active');
    },

    // -------------------------  Logout  ------------------------- //

    startLogout() {
        BuildMessageBox('Are you sure you want to logout?', '');

        const buttonBox = document.getElementById('Button-Div');
        if (!buttonBox) return;

        buttonBox.innerHTML = '';
        buttonBox.style.width = '140px';

        const yesBtn = document.createElement('button');
        yesBtn.className = 'accept OkayButton';
        yesBtn.innerText = 'Yes';
        yesBtn.addEventListener('click', () => OkayButtonPress('Index'));

        const noBtn = document.createElement('button');
        noBtn.className = 'cancel OkayButton';
        noBtn.innerText = 'No';
        noBtn.addEventListener('click', () => OkayButtonPress(''));

        buttonBox.appendChild(yesBtn);
        buttonBox.appendChild(noBtn);
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

function AdminButtonController(subPage) { NavBar.adminPage(subPage); }
function TicketsButtonController() { NavBar.tickets(); }
function TasksButtonController() { NavBar.tasks(); }
function SetActivePage(pageName) { NavBar.setActivePage(pageName); }
function StartLogout() { NavBar.startLogout(); }
function BringForwardNav() { NavBar.bringForward(); }
function PushBackNav() { NavBar.pushBack(); }
