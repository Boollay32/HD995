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

    }

    // -------------------------  Submit  ------------------------- //

    async submitUser() {
        if (!validateForm(this.formId)) return;

        const submitButton = document.getElementById('SubmitCreatedUser');
        if (submitButton) submitButton.disabled = true;
        ToggleWaiting();

        try {
            const payload = this._collectFormData();
            const response = await API.post('User/CreateUser', API.authPayload(payload));
            if (!response) return;

            this._handleCreateSuccess(response);

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
            userLogin:   val('LoginName'),
            firstName:   val('FirstName'),
            lastName:    val('SecondName'),
            phone:       val('PhoneNumber'),
            authorityId: parseInt(document.getElementById('Authority')?.value, 10) || 0,
            department:  parseInt(document.getElementById('Department')?.value, 10) || 0
        };
    }

    // -------------------------  Create Success  ------------------------- //

    _handleCreateSuccess(data) {
        const raw = (typeof data === 'string') ? data.trim() : '';
        // CreateUser returns the new user's PIN (numeric string). A non-numeric
        // value is a backend message (e.g. validation) - show it as-is.
        const message = /^\d+$/.test(raw)
            ? `User created.\n\nPIN: ${raw}\n\nThe password has been set to: Helpdesk\n\nGive both to the new user. They'll be asked to set their own password the first time they log in.`
            : (raw || 'User created.');
        BuildMessageBox(message, 'Users');
    }
}

// -------------------------  Init  ------------------------- //

const page = new CreateUser();
document.addEventListener('DOMContentLoaded', () => page.init());

// -------------------------  Legacy Wrappers  ------------------------- //

function SubmitCreatedUser() { page.submitUser(); }