// =============================  CreateTicket.js  ============================= //

class CreateTicket extends PageBase {
    constructor() {
        super();
        this.customFieldBuilder = new CustomFieldBuilder();
        this.formId = 'create-ticket';
        this.files = [];
    }

    // -------------------------  Init  ------------------------- //

    async init() {
        if (!await this.checkAuth()) return;

        try {
            sessionStorage.setItem(STORAGE_KEYS.SEARCH_OR_TICKET, '1');

            await Promise.all([
                this.waitForElement(this.formId),
                Dropdowns.load('Ticket')
            ]);

            this._setupPageUI();
            this._setupEventListeners();

        } catch (error) {
            this.handleError('Error initializing create ticket');
        }
    }

    // -------------------------  Page UI  ------------------------- //

    _setupPageUI() {
        SetActivePage('TicketMenu');
        SetDetailContainerHeight();
        UserPermissions();
        ChooseSeason();
        DisplayScreen();
        ClearAllFormInputs(this.formId);
        SetTargetDateMinToday();
    }

    // -------------------------  Event Listeners  ------------------------- //

    _setupEventListeners() {
        // Fix: submit button wired here — replaces onclick in view
        document.getElementById('SubmitCreatedTicket')
            ?.addEventListener('click', () => this.submitTicket());

        // Fix: requestType change wired here — replaces onchange in view
        document.getElementById('requestType')
            ?.addEventListener('change', () => this._onRequestTypeChange());

        // Fix: textarea auto-grow wired here — replaces onkeydown in view
        document.getElementById('requestDetail')
            ?.addEventListener('keydown', (e) => auto_grow(e.target));

        // Attachments: composer-style drop zone + click-to-browse + chips
        const bin = document.getElementById('AttachBin');
        const fileInput = document.getElementById('ct-file-input');
        bin?.addEventListener('click', () => fileInput?.click());
        bin?.addEventListener('dragover', (e) => {
            e.preventDefault();
            bin.classList.add('is-dragover');
        });
        bin?.addEventListener('dragleave', () => bin.classList.remove('is-dragover'));
        bin?.addEventListener('drop', (e) => {
            e.preventDefault();
            bin.classList.remove('is-dragover');
            this._addFiles(e.dataTransfer?.files);
        });
        fileInput?.addEventListener('change', (e) => {
            this._addFiles(e.target.files);
            e.target.value = '';
        });


        window.addEventListener('resize', () => SetDetailContainerHeight());
    }

    async _onRequestTypeChange() {
        const requestId = document.getElementById('requestType')?.value;
        if (!requestId) return;

        await this.customFieldBuilder.changeCustomFields(requestId);
        await Dropdowns.load('Ticket');
    }

    // -------------------------  Attachments  ------------------------- //

    _addFiles(list) {
        if (!list?.length) return;
        this.files.push(...Array.from(list));
        this._renderAttachmentChips();
    }

    _renderAttachmentChips() {
        const holder = document.getElementById('ct-attachment-list');
        if (!holder) return;

        holder.replaceChildren();
        this.files.forEach((file, index) => {
            const chip = document.createElement('span');
            chip.className = 'ct-att-chip';

            const name = document.createElement('span');
            name.className = 'ct-att-name';
            name.textContent = file.name;
            name.title = file.name;

            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'ct-att-remove';
            remove.setAttribute('aria-label', `Remove ${file.name}`);
            remove.textContent = '\u00d7';
            remove.addEventListener('click', () => {
                this.files.splice(index, 1);
                this._renderAttachmentChips();
            });

            chip.append(name, remove);
            holder.appendChild(chip);
        });
    }

    // -------------------------  Submit  ------------------------- //

    async submitTicket() {
        if (!validateForm(this.formId)) return;

        // Fix: correct button ID — was 'Submit-Button' — not found in view
        const submitButton = document.getElementById('SubmitCreatedTicket');
        if (submitButton) submitButton.disabled = true;
        ToggleWaiting();

        try {
            const { formData, note, contactClient } = this._collectFormData();
            const response = await this._submitTicket(formData, contactClient);
            if (!response) return;

            await this._handleCreateSuccess(response, note, contactClient);

        } catch (error) {
            if (error.message !== 'Unauthorized') {
                this.handleError("Error: Couldn't create ticket");
            }
        } finally {
            ToggleWaiting();
            if (submitButton) submitButton.disabled = false;
        }
    }

    // -------------------------  Data Collection  ------------------------- //

    _collectFormData() {
        const elements = document.getElementsByClassName('Value');
        const formData = Form.getValues(elements);
        const note = document.getElementById('requestDetail')?.value ?? '';
        const contactClient = this._getContactClient(elements);

        return { formData, note, contactClient };
    }

    _getContactClient(elements) {
        const requestType = elements['requestType']?.value;
        if (requestType !== '12') return '';

        const authority = elements['Authority']?.value ?? '';
        const clientId = elements['assignedClientID']?.value ?? '';
        return `${authority}|${clientId}`;
    }

    async _submitTicket(formData, contactClient) {
        return API.post('Ticket/SaveTicket', API.authPayload({
            ...formData,
            contactClient,
            emailSent: 0
        }));
    }

    // -------------------------  Create Success  ------------------------- //

    async _handleCreateSuccess(data, note, contactClient) {
        // Fix: named property — replaces magic array index data[1]
        const newTicketId = data.id ?? data.ticketId;

        // The description becomes the ticket's first, client-visible note,
        // carrying the attachments (shared SaveOriginalNote next to Composer).
        try {
            await SaveOriginalNote(this.files, false, note, newTicketId);
        } catch (err) {
            console.error('Original note save failed:', err);
            UI.toast?.('Ticket created, but saving the first note failed', 'warning');
        }

        if (contactClient) {
            this._sendNotificationEmail('Ticket', 'CreatedFor', newTicketId);
        }

        BuildMessageBox(`Created Ticket ${newTicketId}`, 'TicketPage');
    }
}

// -------------------------  Init  ------------------------- //

// Fix: page hoisted to module scope — legacy wrappers can access it
const page = new CreateTicket();
document.addEventListener('DOMContentLoaded', () => page.init());

// -------------------------  Legacy Wrappers  ------------------------- //

function SubmitCreatedTicket() { page.submitTicket(); }
function selector1DropDown() { page._onRequestTypeChange(); }
