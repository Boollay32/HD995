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
        Form.gateSubmit(this.formId, 'SubmitCreatedTicket');

        // Fix: requestType change wired here — replaces onchange in view
        document.getElementById('requestType')
            ?.addEventListener('change', () => this._onRequestTypeChange());

        // Auto-grow the description as the user types (UI.autoGrow is the
        // real, hidden-safe implementation; auto_grow was never defined).
        document.getElementById('requestDetail')
            ?.addEventListener('input', (e) => UI.autoGrow(e.target));

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

        // Cap the total at 5 attachments, matching the shared Composer used
        // by notes/messages/RFC.
        const MAX_ATTACHMENTS = 5;
        const remaining = MAX_ATTACHMENTS - this.files.length;
        if (remaining <= 0) {
            UI.toast?.(`Maximum ${MAX_ATTACHMENTS} attachments allowed`, 'warning');
            return;
        }
        const incoming = Array.from(list);
        if (incoming.length > remaining) {
            UI.toast?.(`Maximum ${MAX_ATTACHMENTS} attachments allowed`, 'warning');
        }
        this.files.push(...incoming.slice(0, remaining));
        this._renderAttachmentChips();
    }

    _renderAttachmentChips() {
        const holder = document.getElementById('ct-attachment-list');
        if (!holder) return;

        // Render attachments with the same markup + classes as the message/note
        // composer (Composer._buildChip): a hover-expand tile showing the file
        // icon, name, size, and an SVG remove button. Reusing the td-attach-chip
        // classes means create-ticket attachments look and behave identically to
        // message attachments.
        const fmtIcon = (typeof Format !== 'undefined' && Format.fileIcon)
            ? n => Format.fileIcon(n) : () => '';
        const fmtSize = (typeof Format !== 'undefined' && Format.fileSizeLabel)
            ? b => Format.fileSizeLabel(b) : () => '';
        const esc = (typeof Format !== 'undefined' && Format.escapeHtml)
            ? s => Format.escapeHtml(s) : s => s;

        holder.replaceChildren();
        this.files.forEach((file, index) => {
            const chip = document.createElement('div');
            chip.className = 'td-attach-chip';
            chip.dataset.index = index;
            chip.innerHTML = `
                <span aria-hidden="true">${fmtIcon(file.name)}</span>
                <span class="td-chip-name">${esc(file.name)}</span>
                <span class="td-chip-size mono">${fmtSize(file.size)}</span>
                <button type="button" aria-label="Remove ${esc(file.name)}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" stroke-width="2.5"
                         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>`;
            chip.querySelector('button')?.addEventListener('click', () => {
                this.files.splice(index, 1);
                this._renderAttachmentChips();
            });
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
        // SaveTicketRequest expects the pipe-backtick ObjectInfo format. The
        // keys are the field element ids; TicketMapper maps them onto the
        // Ticket model case-insensitively, so custom fields persist too.
        const objectInfo = Object.entries(formData)
            .filter(([, v]) => v !== null && v !== undefined && v !== '')
            .map(([k, v]) => `${k}\`${v}`)
            .join('|');

        const payload = { objectInfo, falseReply: false, emailSent: 0 };

        if (contactClient) {
            const [authorityId, clientId] = contactClient.split('|');
            payload.contactClientAuthorityId = parseInt(authorityId, 10) || null;
            payload.contactClientUserId = parseInt(clientId, 10) || null;
        }

        return API.post('Ticket/SaveTicket', API.authPayload(payload));
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

