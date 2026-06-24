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
        // Claim the menu synchronously so the global gate (gateMenuGlobally)
        // backs off and lets this page gate -- prevents any flash.
        Auth._gatingMenu = true;
        try {
            const adminId = await Auth.getAdminLevel();

            if (adminId == null) { Auth.applyMenuVisibility(null); return; }

            this.setAdminAbilities(adminId);
            this.checkLimitedUserPerms(adminId);
        } catch (error) {
            console.error('Error checking permissions:', error);
            // Deny by default on failure: reveal the (now-empty) menu rather
            // than leaving it stuck hidden.
            Auth.applyMenuVisibility(sessionStorage.getItem(STORAGE_KEYS.ADMIN_LEVEL));
        }
    },

    // -------------------------  Admin Abilities  ------------------------- //

    setAdminAbilities(adminId) {
        // Menu visibility is allow-list (see Auth.MENU_ALLOW): show only the
        // items this level may see and hide the rest. The same routine runs
        // globally on every page (gateMenuGlobally), so the menu is consistent
        // even on pages that never call checkPermissions.
        Auth.applyMenuVisibility(adminId);

        // Govtech levels (standard + admin) get the extra in-page controls.
        if ([1, 2].includes(parseInt(adminId, 10))) {
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

// -------------------------  Menu Gating (allow-list)  ------------------------- //

// The nav menu is deny-by-default: every item is hidden (CSS, until
// .perms-ready) and we SHOW only the ids the current admin level may see.
// Applied on every page (gateMenuGlobally) and on permission-checked pages
// (setAdminAbilities) -- both go through applyMenuVisibility so the menu is
// identical everywhere and forbidden items never appear, even briefly.
Auth.MENU_ITEMS = ['TicketsMenu', 'TasksMenu', 'ProjectsMenu', 'RFCMenu', 'IncidentsMenu', 'UsersMenu', 'StatsMenu'];
Auth.MENU_ALLOW = {
    0: ['TicketsMenu', 'UsersMenu'],                                                          // Authority (client)
    1: ['TicketsMenu', 'TasksMenu', 'ProjectsMenu', 'RFCMenu', 'IncidentsMenu', 'UsersMenu'], // Standard Govtech
    2: ['TicketsMenu', 'TasksMenu', 'ProjectsMenu', 'RFCMenu', 'IncidentsMenu', 'UsersMenu', 'StatsMenu'], // Admin
    4: ['RFCMenu']                                                                            // RFC only
};

Auth.applyMenuVisibility = function (adminId) {
    const allow = Auth.MENU_ALLOW[parseInt(adminId, 10)] || [];   // unknown / not-logged-in -> nothing
    Auth.MENU_ITEMS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = allow.includes(id) ? '' : 'none';
    });
    document.getElementById('navbar-menu')?.classList.add('perms-ready');
};

// Admin level is fetched once and cached for the session (UI hint only -- the
// server still enforces real access). Concurrent callers share one in-flight
// request. Cleared by sessionStorage.clear() on login/logout.
Auth._adminLevelPromise = null;
Auth.getAdminLevel = function () {
    const cached = sessionStorage.getItem(STORAGE_KEYS.ADMIN_LEVEL);
    if (cached != null) return Promise.resolve(cached);
    if (Auth._adminLevelPromise) return Auth._adminLevelPromise;
    Auth._adminLevelPromise = API.post('Authenticator/CheckAdmin', {
        userName: sessionStorage.getItem(STORAGE_KEYS.USER_NAME),
        utc: UTCWorkAround()
    }).then(id => {
        if (id != null) sessionStorage.setItem(STORAGE_KEYS.ADMIN_LEVEL, id);
        Auth._adminLevelPromise = null;
        return id;
    }).catch(err => {
        Auth._adminLevelPromise = null;
        throw err;
    });
    return Auth._adminLevelPromise;
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

// The nav menu is allow-list gated on every page. Pages that call
// checkPermissions gate themselves (and set _gatingMenu); for any page that
// doesn't (e.g. ticket details), this global fallback fetches the admin level
// and applies the same allow-list. Result: the menu is correct everywhere and
// forbidden items never appear -- deny by default. Deferred a tick so a page's
// own checkPermissions (run in its DOMContentLoaded) can claim it first.
(function gateMenuGlobally() {
    function arm() {
        setTimeout(function () {
            if (Auth._gatingMenu) return;          // an opt-in page is handling it
            Auth.getAdminLevel()
                .then(id => Auth.applyMenuVisibility(id))
                .catch(() => Auth.applyMenuVisibility(null));
        }, 0);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', arm);
    } else {
        arm();
    }
})();
