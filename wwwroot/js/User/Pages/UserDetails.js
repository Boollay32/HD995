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
        this.userLogin = sessionStorage.getItem(STORAGE_KEYS.USER_ID);
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
        document.getElementById('DeleteUser-Button')?.addEventListener('click', (e) => {
            e.currentTarget.dataset.mode === 'activate'
                ? userSave.confirmActivate()
                : userSave.confirmDelete();
        });
    }

    // -------------------------  Load Data  ------------------------- //

    async _loadUserData() {
        const data = await UserLoader.getDetail(this.userLogin);
        if (data) FillUserDetail(data);
        // Raw lock state (the Locked select cannot represent 99/deactivated)
        this.userLocked = Number(data?.locked) || 0;
    }

    // -------------------------  Admin Controls  ------------------------- //

    _setupExtraControls() {
        const isAdmin = this.adminId === 2;

        if (isAdmin) {
            UI.showById('ResetUser-Button,DeleteUser-Button');
            UI.enableById('UserPhone,AdminLevel');
            this._setDeleteButtonLabel();
            this._setupUnlockButton();
            this._wireDirtyTracking();
        } else {
            UI.hideById('ResetUser-Button,DeleteUser-Button,UpdateUser-Button');
            UI.disableById('UserPhone,AdminLevel');
        }
    }

    // The account can only be UNLOCKED from the UI (the UserManage proc has
    // no lock path). Show the Unlock button only for a genuinely locked
    // account (locked === 1; not active 0, not deactivated 99).
    _setupUnlockButton() {
        const btn = document.getElementById('Unlock-Button');
        if (!btn) return;
        if (this.userLocked === 1) {
            btn.style.display = '';
            btn.addEventListener('click', () => userSave.unlockUser());
        } else {
            btn.style.display = 'none';
        }
    }

    // State-aware: deactivated accounts (locked 99) offer reactivation;
    // everyone else gets the deactivate action. (The old version compared
    // the Locked select's value to 'No', but the option values are '0'/'1',
    // so the label was permanently 'Activate User' while the click always
    // ran the delete confirm.) Label lives in the <span> so the icon
    // survives.
    // Save changes is active only when an editable field differs from its
    // loaded value (mirrors the ticket Details tab). Fields are already
    // populated (_loadUserData ran before _setupExtraControls).
    _wireDirtyTracking() {
        const ids = ['UserPhone', 'AdminLevel'];
        const els = ids.map(id => document.getElementById(id)).filter(Boolean);
        const saveBtn = document.getElementById('UpdateUser-Button');
        if (!saveBtn) return;

        const baseline = els.map(el => el.value);
        const refresh = () => {
            const dirty = els.some((el, i) => el.value !== baseline[i]);
            saveBtn.disabled = !dirty;
        };
        els.forEach(el => {
            el.addEventListener('input', refresh);
            el.addEventListener('change', refresh);
        });
        saveBtn.disabled = true;
    }

    _setDeleteButtonLabel() {
        const deleteBtn = document.getElementById('DeleteUser-Button');
        if (!deleteBtn) return;

        const isDeactivated = this.userLocked === 99;
        const span = deleteBtn.querySelector('span');
        if (span) span.innerText = isDeactivated ? 'Activate user' : 'Deactivate user';
        deleteBtn.dataset.mode = isDeactivated ? 'activate' : 'delete';
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

// Form submit is a no-op (was inline onsubmit="return false"; moved
// out so script-src can later drop 'unsafe-inline').
document.addEventListener('DOMContentLoaded', function () {
    var f = document.getElementById('User-Form');
    if (f) f.addEventListener('submit', function (e) { e.preventDefault(); });
});
