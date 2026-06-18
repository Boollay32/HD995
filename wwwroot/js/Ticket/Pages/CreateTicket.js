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
            await this._setupProjectLock();
            const preselectedType = this._filterRequestTypes();
            if (preselectedType) await this._onRequestTypeChange();

        } catch (error) {
            this.handleError('Error initializing create ticket');
        }
    }

    // -------------------------  Page UI  ------------------------- //

    async _setupProjectLock() {
        // When arriving from a project ("New ticket" inside a project), a
        // ProjectID is in session. Show the locked Project field, stamp the
        // hidden projectID input (flows into objectInfo -> Ticket.ProjectID),
        // and display the project name. The key is cleared so a later manual
        // ticket is not silently attached to the same project.
        // Set only by a project's "+ New ticket" button (a dedicated key, so
        // merely viewing a project never leaks into a queue-opened ticket).
        const projectId = sessionStorage.getItem('NewTicketProjectID');
        this._projectContext = !!projectId;
        if (!projectId) return;
        sessionStorage.removeItem('NewTicketProjectID');

        const input = document.getElementById('projectID');
        const row = document.getElementById('ct-project-row');
        const nameEl = document.getElementById('ct-project-name');
        if (input) input.value = projectId;
        if (row) row.style.display = '';

        try {
            const data = await API.post('Project/GetProjectDetail',
                API.authPayload({ projectId: parseInt(projectId, 10) }));
            if (nameEl) nameEl.textContent = (data && data.projectName)
                ? data.projectName
                : ('Project #' + projectId);
        } catch (err) {
            console.error('CreateTicket._setupProjectLock:', err);
            if (nameEl) nameEl.textContent = 'Project #' + projectId;
        }
    }

    // Shape the request-type dropdown by CONTEXT and ROLE. Authority (who may
    // use a type at all) is enforced server-side in usp_Helpdesk_References_1,
    // so this never widens access - it only hides types that do not belong on
    // this form.
    //   In-project create -> project request types only.
    //   Main create       -> every type the server returned, minus project
    //                         types and the retired 'Project Ticket' (13).
    // Incident (8) now has its own Incidents page, so it is hidden from the
    // main form; the Incidents "New ticket" button locks the form to it.
    // Process Reports (5) is a main (client) type, not a project one. Web Help
    // Desk (9) stays a client query. Adjust the lists below if these change.
    _filterRequestTypes() {
        const select = document.getElementById('requestType');
        if (!select) return;

        const INCIDENT = '8';
        const CONTACT_CLIENT = '12';

        // From the Incidents page "New ticket" -> lock this form to incidents only.
        const incidentContext = sessionStorage.getItem('NewTicketIncident') === '1';
        if (incidentContext) sessionStorage.removeItem('NewTicketIncident');

        // Govtech (authority 151) raises only Contact Client tickets here; clients
        // raise every other type but never Contact Client (that is Govtech-only).
        const isGovtech = sessionStorage.getItem(STORAGE_KEYS.AUTHORITY_ID) === '151';

        const PROJECT_TYPES = ['4', '10', '11'];                  // Process Reports (5) belongs on the main form
        const MAIN_EXCLUDE = [...PROJECT_TYPES, '13', INCIDENT];  // main hides project types, retired 13, and incidents

        const allowed = (value) =>
            incidentContext        ? value === INCIDENT
            : this._projectContext ? PROJECT_TYPES.includes(value)
            : isGovtech            ? value === CONTACT_CLIENT
            : !MAIN_EXCLUDE.includes(value) && value !== CONTACT_CLIENT;

        for (const option of Array.from(select.options)) {
            if (!allowed(option.value)) option.remove();
        }

        // Govtech main create is always Contact Client; incident context locks to
        // incidents. The preselected type is returned so init runs its custom fields.
        if (incidentContext) {
            select.selectedIndex = 0;
            return INCIDENT;
        } else if (isGovtech && !this._projectContext) {
            select.value = CONTACT_CLIENT;
            return CONTACT_CLIENT;
        } else {
            select.selectedIndex = -1;
        }
        return null;
    }

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

        // Attachments: click the paperclip (td-attach-btn) to browse - no drag-drop.
        document.getElementById('ct-file-input')?.addEventListener('change', (e) => {
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
        const newTicketId = data.objectID ?? data.id ?? data.ticketId;

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

        // Created inside a project: open the new ticket directly (same path
        // the project ticket list uses) rather than returning to the queue.
        if (this._projectContext) {
            sessionStorage.setItem(STORAGE_KEYS.TICKET_ID, String(newTicketId));
            Nav.toTicketDetails();
            return;
        }

        BuildMessageBox(`Created Ticket ${newTicketId}`, 'TicketPage');
    }
}

// -------------------------  Init  ------------------------- //

// Fix: page hoisted to module scope — legacy wrappers can access it
const page = new CreateTicket();
document.addEventListener('DOMContentLoaded', () => page.init());

// -------------------------  Legacy Wrappers  ------------------------- //

