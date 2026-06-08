// =============================  UserDetails.js  ============================= //
// Orchestrator for the user detail page. Population lives in UserFields.js,
// the data fetch in UserLoader.js, and the write operations in UserSave.js.
//
// Phase 6 fixes:
//   * init() no longer calls the undefined UserDetails._fetch(); the admin level
//     comes from AdminContext.resolve() (memoized CheckAdmin), stored as
//     this.adminId, and auth is checked before any setup.
//   * _setupExtraControls() reads this.adminId instead of an undefined `adminId`.
//   * The Update / Delete / Reset buttons (rendered by _DetailsHeader with no
//     handler) are now wired to UserSave.

class UserManager extends PageBase {

    constructor() {
        super();
        this.userLogin = sessionStorage.getItem(STORAGE_KEYS.VIEW_USER_LOGIN);
        this.adminId = 0;
    }

    // -------------------------  Init  ------------------------- //

    async init() {
        if (!await this.checkAuth()) return;

        this.adminId = await AdminContext.resolve();

        try {
            this._setupPageUI();
            this._setupEventListeners();
            await this._loadUserData();
            this._setupExtraControls();
        } catch (error) {
            if (error.message !== 'Unauthorized') {
                this.handleError('Error initializing user details');
            }
        }
    }

    // -------------------------  Page UI  ------------------------- //

    _setupPageUI() {
        SetActivePage('UserMenu');
        Layout.setDetailContainerHeight();
        Auth.checkPermissions();
        Layout.chooseSeason();
        Layout.displayScreen();
    }

    // -------------------------  Event Listeners  ------------------------- //

    _setupEventListeners() {
        window.addEventListener('resize', () => Layout.setDetailContainerHeight());

        // Action buttons (rendered by _DetailsHeader without handlers) -> UserSave
        document.getElementById('UpdateUser-Button')?.addEventListener('click', () => userSave.manageUser());
        document.getElementById('ResetUser-Button')?.addEventListener('click', () => userSave.confirmReset());
        document.getElementById('DeleteUser-Button')?.addEventListener('click', () => userSave.confirmDelete());
    }

    // -------------------------  Load Data  ------------------------- //

    async _loadUserData() {
        const data = await UserLoader.getDetail(this.userLogin);
        if (data) FillUserDetail(data);
    }

    // -------------------------  Admin Controls  ------------------------- //

    _setupExtraControls() {
        const isAdmin = this.adminId === 2;

        if (isAdmin) {
            UI.showById('ResetUser-Button,DeleteUser-Button');
            UI.enableById('UserPhone,AdminLevel,Locked');
            this._setDeleteButtonLabel();
        } else {
            UI.hideById('ResetUser-Button,DeleteUser-Button,UpdateUser-Button');
            UI.disableById('UserPhone,AdminLevel,Locked');
        }
    }

    _setDeleteButtonLabel() {
        const lockedEl = document.getElementById('Locked');
        const deleteBtn = document.getElementById('DeleteUser-Button');
        if (!lockedEl || !deleteBtn) return;

        deleteBtn.innerText = lockedEl.value === 'No'
            ? 'Disable User'
            : 'Activate User';
    }
}

// -------------------------  Init  ------------------------- //

const userManager = new UserManager();

document.addEventListener('DOMContentLoaded', async () => {
    await userManager.init();
});

// -------------------------  Global  ------------------------- //

if (typeof window !== 'undefined') {
    window.userManager = userManager;
}

// -------------------------  Legacy Wrappers  ------------------------- //
// Kept for any external callers; write operations now live on UserSave.

function UpdateUser() { userSave.updateUser(); }
function ManageUser() { userSave.manageUser(); }
function ResetUserQuestion() { userSave.confirmReset(); }
function ResetUser() { userSave.resetUser(); }
function DeleteUserQuestion() { userSave.confirmDelete(); }
function DeleteUser() { userSave.deleteUser(); }
