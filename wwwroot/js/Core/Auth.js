// =============================  Auth.js  ============================= //

const Auth = {

    // -------------------------  Keep Alive  ------------------------- //

    _isMessageBoxVisible() {
        const el = document.getElementById('MessageBox-ScreenCover-Div');
        return el?.classList.contains('BackgroundTint') ?? false;
    },

    _onUserActivity() {
        if (window.location.pathname === '/') return;
        if (this._isMessageBoxVisible()) return;
        this.keepAlive();
    },

    keepAlive() {
        if (!sessionStorage.getItem(STORAGE_KEYS.USER_NAME)) return;

        const lastMove = sessionStorage.getItem('LastMouseMove');
        const now = Date.now();

        if (lastMove) {
            const next = +lastMove + 30000;
            if (next < now) {
                sessionStorage.setItem('LastMouseMove', now);
                this.authenticateUser();
            }
        } else {
            sessionStorage.setItem('LastMouseMove', now);
            this.authenticateUser();
        }
    },

    // -------------------------  Authenticate  ------------------------- //


    async authenticateUser() {
        const userName = sessionStorage.getItem(STORAGE_KEYS.USER_NAME);

        if (!userName) return;

        try {
            const data = await API.post('Authenticator/Authenticate', {
                userName,
                utc: UTCWorkAround()
            });

            if (!data?.userID) {
                BuildMessageBox('Your session has timed out.', 'Index');
            } else {
                UI.showByTag('body');
            }
        } catch (error) {
            console.error('Authentication error:', error);
            BuildMessageBox('Your Session has timed out.', 'Index');
        }
    },

    // -------------------------  User Permissions  ------------------------- //

    async checkPermissions() {
        // Claim the menu synchronously so revealMenuFallback backs off and lets
        // the (async) gating below do the reveal -- prevents the all-items flash.
        Auth._gatingMenu = true;
        try {
            const adminId = await API.post('Authenticator/CheckAdmin', {
                userName: sessionStorage.getItem(STORAGE_KEYS.USER_NAME),
                utc: UTCWorkAround()
            });

            if (adminId == null) return;

            this.setAdminAbilities(adminId);
            this.checkLimitedUserPerms(adminId);
        } catch (error) {
            console.error('Error checking permissions:', error);
        } finally {
            // HD36: reveal the menu now that gating has run (the restricted
            // items already have inline display:none and stay hidden). In a
            // finally so a null/failed CheckAdmin still shows the menu rather
            // than leaving it permanently blank.
            document.getElementById('navbar-menu')?.classList.add('perms-ready');
        }
    },

    // -------------------------  Admin Abilities  ------------------------- //

    setAdminAbilities(adminId) {
        // restrict = the menu item ids to HIDE for that admin level. (These were
        // previously 'subnav-*' ids that don't exist in the nav, so nothing was
        // hidden -- clients wrongly saw Tasks + RFC. Use the real *Menu ids. HD35 B6.)
        // Projects/Incidents/Stats are also enforced by the explicit hideById calls below.
        const ADMIN_CONFIG = {
            // Authority (client): Tickets + Users only.
            0: { restrict: 'TasksMenu,ProjectsMenu,RFCMenu,IncidentsMenu,StatsMenu', extra: false },
            // Standard Govtech: everything except Stats (Stats is level 2 only, handled below).
            1: { restrict: '', extra: true },
            // Admin Govtech: everything.
            2: { restrict: '', extra: true },
            // RFC Only: just RFC (+ the account/logout chrome).
            4: { restrict: 'TicketsMenu,TasksMenu,ProjectsMenu,IncidentsMenu,UsersMenu,StatsMenu', extra: false }
        };

        const config = ADMIN_CONFIG[adminId] ?? {
            restrict: 'TicketsMenu,TasksMenu,ProjectsMenu,RFCMenu,IncidentsMenu,UsersMenu,StatsMenu',
            extra: false
        };

        if (config.restrict) {
            UI.hideAll(config.restrict);
        }

        // Stats is admin-level-2 only
        if (parseInt(adminId, 10) !== 2) {
            UI.hideById('StatsMenu');
        }

        // Projects and Incidents are Govtech-only (admin levels 1 and 2). Clients never see them.
        if (![1, 2].includes(parseInt(adminId, 10))) {
            UI.hideById('ProjectsMenu');
            UI.hideById('IncidentsMenu');
        }

        if (config.extra) {
            this._applyExtraFunctionality();
            MakeDropDownsEditable();
        }
    },

    _applyExtraFunctionality() {
        const authority = document.getElementById('Authority');
        if (authority) UI.showObject(authority.parentElement);

        UI.show('Visible-Button');

        const assignedTechName = document.getElementById('assignedTechName');
        if (assignedTechName) {
            const myTickets = sessionStorage.getItem(STORAGE_KEYS.MY_TICKETS);
            const authorityId = sessionStorage.getItem(STORAGE_KEYS.AUTHORITY_ID);
            if (myTickets === '0' && authorityId === '151') {
                UI.showObject(assignedTechName.parentElement);
            }
        }
    },

    // -------------------------  Limited User Perms  ------------------------- //

    checkLimitedUserPerms(adminId) {
        const admin = parseInt(adminId ?? '0', 10);
        const loginPage = sessionStorage.getItem('LoginPage');
        const page = window.location.pathname;

        const rfcOnlyPages = ['/RFC', '/RFCDetails', '/CreateRFC'];
        const authorityPages = ['/TicketPage', '/TicketDetails', '/CreateTicket', '/UserPage', '/UserDetails'];

        if (admin === 4 && !rfcOnlyPages.includes(page)) {
            if (loginPage !== '1') RFCView();
        } else if (admin === 0 && !authorityPages.includes(page)) {
            window.location.href = '/TicketPage';
        } else {
            DisplayMenu();
        }
    },

    // -------------------------  Account Name  ------------------------- //

    getAccountName(userName) {
        if (!userName) return '';

        const [localPart] = userName.split('@');
        const parts = localPart.split('.');

        const firstName = parts[0]
            ? parts[0][0].toUpperCase() + parts[0].slice(1)
            : '';

        const surname = parts[1]
            ? parts[1][0].toUpperCase() + parts[1].slice(1)
            : '';

        this._checkEnvironment();

        return `${firstName} ${surname}`.trim();
    },

    // -------------------------  Environment  ------------------------- //

    _checkEnvironment() {
        const hostname = window.location.hostname;
        const nameEl = document.getElementById('Account-Name');
        if (!nameEl) return;

        if (hostname === 'testgovtechhelpdesk.azurewebsites.net') {
            nameEl.innerText = 'TEST Server';
            nameEl.style.marginRight = '10px';
        }
    },

    // -------------------------  Activity Listeners  ------------------------- //

    initActivityListeners() {
        document.addEventListener('mousemove', () => this._onUserActivity());
        document.addEventListener('keydown', () => this._onUserActivity());
    }
};

// -------------------------  Legacy Wrappers  ------------------------- //

function UserPermissions() { return Auth.checkPermissions(); }
function AuthenticateUser(user, token) { return Auth.authenticateUser(); }
function KeepThePageAlive() { Auth.keepAlive(); }
function SetUserAdminAbilities(adminId) { Auth.setAdminAbilities(adminId); }
function CheckLimitedGovtechUserPerms() { Auth.checkLimitedUserPerms(); }
function GetAccountName(userName) { return Auth.getAccountName(userName); }
function DisplayExtraGovtechFunctionality() { Auth._applyExtraFunctionality(); }

// -------------------------  Init Activity Listeners  ------------------------- //

Auth.initActivityListeners();

// HD37 2a: safety net for the nav menu. The menu items are hidden until
// #navbar-menu gets `.perms-ready` (added by checkPermissions). If a page
// never runs the permission check, the menu would stay blank -- so once the
// DOM is ready, reveal it on the next tick if nothing has marked it ready.
// Pages that DO gate add the class first, so this never causes a flash.
(function revealMenuFallback() {
    function arm() {
        setTimeout(function () {
            // Only reveal if no page claimed the menu via checkPermissions; a
            // gating page reveals itself after hiding its restricted items.
            if (!Auth._gatingMenu) {
                document.getElementById('navbar-menu')?.classList.add('perms-ready');
            }
        }, 0);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', arm);
    } else {
        arm();
    }
})();
