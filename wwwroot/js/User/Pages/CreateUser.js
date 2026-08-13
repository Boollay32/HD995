// =============================  CreateUser.js  ============================= //
//
// Focused create-user page, mirroring CreateRFC / CreateTicket. Restores the
// "Add User" capability that used to live on the retired multi-function Admin
// page. The backend (User/CreateUser) is unchanged and is gated to Govtech
// admins server-side; this page is the front end for it.

class CreateUser extends PageBase {
    constructor() {
        super();
        this.formId = 'create-user';
    }

    // -------------------------  Init  ------------------------- //

    async init() {
        if (!await this.checkAuth()) return;
        try {
            await Promise.all([
                this.waitForElement(this.formId),
                Dropdowns.load('Ticket')   // populates the Authority + Department selects
            ]);

            this._setupPageUI();
            this._setupEventListeners();
        } catch (error) {
            this.handleError('Error initializing create user');
        }
    }

    // -------------------------  Page UI  ------------------------- //

    _setupPageUI() {
        SetActivePage('UserMenu');
        UserPermissions();
        ChooseSeason();
        DisplayScreen();
        ClearAllFormInputs(this.formId);
    }

    // -------------------------  Event Listeners  ------------------------- //

    _setupEventListeners() {
        document.getElementById('SubmitCreatedUser')
            ?.addEventListener('click', () => this.submitUser());
        Form.gateSubmit(this.formId, 'SubmitCreatedUser');

        // The user type follows the chosen authority until the creator picks
        // one themselves: Govtech (authority 151, same constant CreateTicket.js
        // uses) defaults to Govtech User, everything else to Authority User.
        const typeSelect = document.getElementById('AdminLevel');
        typeSelect?.addEventListener('change', () => { this._typeTouched = true; });
        document.getElementById('Authority')?.addEventListener('change', (e) => {
            if (this._typeTouched || !typeSelect) return;
            typeSelect.value = e.target.value === '151' ? '1' : '0';
        });
    }

    // -------------------------  Submit  ------------------------- //

    async submitUser() {
        if (!validateForm(this.formId)) return;

        // HD40 7b: phone must be a valid format when provided.
        const phoneEl = document.getElementById('PhoneNumber');
        if (phoneEl && !Form.isValidPhone(phoneEl.value)) {
            phoneEl.classList.add('field-invalid');
            phoneEl.focus();
            UI.toast?.('Please enter a valid phone number', 'warning');
            return;
        }

        const submitButton = document.getElementById('SubmitCreatedUser');
        if (submitButton) submitButton.disabled = true;
        ToggleWaiting();

        try {
            const payload = this._collectFormData();
            const response = await API.post('User/CreateUser', API.authPayload(payload));
            if (!response) return;

            const typeWarning = await this._applyUserType(response);
            this._handleCreateSuccess(response, typeWarning);
        } catch (error) {
            if (error.message !== 'Unauthorized') {
                this.handleError("Error: Couldn't create user");
            }
        } finally {
            ToggleWaiting();
            if (submitButton) submitButton.disabled = false;
        }
    }

    // -------------------------  Data Collection  ------------------------- //

    _collectFormData() {
        const val = id => (document.getElementById(id)?.value ?? '').trim();
        return {
            userLogin: val('LoginName'),
            firstName: val('FirstName'),
            lastName: val('SecondName'),
            phone: val('PhoneNumber'),
            authorityId: parseInt(document.getElementById('Authority')?.value, 10) || 0,
            department: parseInt(document.getElementById('Department')?.value, 10) || 0
        };
    }

    // -------------------------  User Type  ------------------------- //

    // usp_Helpdesk_AddUser always creates an Authority User (level 0); a
    // non-default choice is applied straight after through the existing
    // User/ManageUser endpoint. Same payload shape as UserSave.js:
    // unlockUser is OMITTED so @UnlockUser arrives NULL and the lock state
    // is untouched (HD35). Runs only when the create actually succeeded
    // (pin|tempPassword response). Returns a warning suffix for the
    // success box when the type could not be set.
    async _applyUserType(data) {
        const raw = (typeof data === 'string') ? data.trim() : '';
        const [pin, tempPass] = raw.split('|');
        const created = /^\d+$/.test(pin) && !!tempPass;
        const adminLevelId = document.getElementById('AdminLevel')?.value || '0';
        if (!created || adminLevelId === '0') return '';

        // API.post returns null on failure (it does not throw).
        const result = await API.post('User/ManageUser', API.authPayload({
            userLogin: (document.getElementById('LoginName')?.value ?? '').trim(),
            adminLevelId,
            phone: (document.getElementById('PhoneNumber')?.value ?? '').trim()
        }));
        return result === null
            ? "\n\nNote: the user was created but the user type could not be set. Set it from the user's details page."
            : '';
    }

    // -------------------------  Create Success  ------------------------- //

    _handleCreateSuccess(data, typeWarning = '') {
        const raw = (typeof data === 'string') ? data.trim() : '';
        // CreateUser returns pin|tempPassword (pipe-delimited); a response with
        // no pipe is a backend message (e.g. validation) and is shown as-is.
        const [pin, tempPass] = raw.split('|');
        const message = (/^\d+$/.test(pin) && tempPass)
            ? `User created.\n\nPIN: ${pin}\n\nTemporary password: ${tempPass}\n\nGive both to the new user. They'll be asked to set a new password the first time they log in.`
            : (raw || 'User created.');
        BuildMessageBox(message + typeWarning, 'Users');
    }
}

// -------------------------  Init  ------------------------- //

const page = new CreateUser();
document.addEventListener('DOMContentLoaded', () => page.init());

// -------------------------  Legacy Wrappers  ------------------------- //

function SubmitCreatedUser() { page.submitUser(); }