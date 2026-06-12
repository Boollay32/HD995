// =============================  CreateRFC.js  ============================= //
// New RFC page on the modern create-app shell. Composer-style attachments:
// files are kept on this.files and passed to SaveOriginalNote, which encodes
// them via Composer.encode -- previously null was passed, so RFC attachments
// were silently dropped.

class CreateRFC extends PageBase {
    constructor() {
        super();
        this.formId = 'create-rfc';
        this.files = [];
    }

    // -------------------------  Init  ------------------------- //

    async init() {
        if (!await this.checkAuth()) return;
        try {
            await Promise.all([
                this.waitForElement(this.formId),
                Dropdowns.load('RFC')
            ]);

            this._setupPageUI();
            this._setupEventListeners();

        } catch (error) {
            this.handleError('Error initializing create RFC');
        }
    }

    // -------------------------  Page UI  ------------------------- //

    _setupPageUI() {
        SetActivePage('RFCMenu');
        UserPermissions();
        ChooseSeason();
        DisplayScreen();
        ClearAllFormInputs(this.formId);
        SetTargetDateMinToday();
    }

    // -------------------------  Event Listeners  ------------------------- //

    _setupEventListeners() {
        document.getElementById('SubmitCreatedRFC')
            ?.addEventListener('click', () => this.submitRFC());
        Form.gateSubmit(this.formId, 'SubmitCreatedRFC');

        // Attachments: drop zone + click-to-browse + square icon tiles
        const bin = document.getElementById('AttachBin');
        const fileInput = document.getElementById('cr-file-input');
        bin?.addEventListener('click', () => fileInput?.click());
        bin?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput?.click(); }
        });
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

    // -------------------------  Attachments  ------------------------- //

    _addFiles(list) {
        if (!list?.length) return;

        // Cap the total at 5 attachments, matching the shared Composer.
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
        const holder = document.getElementById('cr-attachment-list');
        if (!holder) return;

        holder.replaceChildren();
        this.files.forEach((file, index) => {
            const chip = document.createElement('span');
            chip.className = 'ct-att-chip';
            chip.tabIndex = 0;

            const icon = document.createElement('span');
            icon.className = 'ct-att-icon';
            icon.setAttribute('aria-hidden', 'true');
            icon.innerHTML = (typeof Format !== 'undefined' && Format.fileIcon)
                ? Format.fileIcon(file.name) : '';

            const name = document.createElement('span');
            name.className = 'ct-att-name';
            name.textContent = file.name;

            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'ct-att-remove';
            remove.setAttribute('aria-label', `Remove ${file.name}`);
            remove.textContent = '\u00d7';
            remove.addEventListener('click', () => {
                this.files.splice(index, 1);
                this._renderAttachmentChips();
            });

            chip.append(icon, name, remove);
            holder.appendChild(chip);
        });
    }

    // -------------------------  Submit  ------------------------- //

    async submitRFC() {
        if (!validateForm(this.formId)) return;

        const submitButton = document.getElementById('SubmitCreatedRFC');
        if (submitButton) submitButton.disabled = true;
        ToggleWaiting();

        try {
            const { formData, note } = this._collectFormData();
            const response = await this._submitRFC(formData);
            if (!response) return;

            await this._handleCreateSuccess(response, note);

        } catch (error) {
            if (error.message !== 'Unauthorized') {
                this.handleError("Error: Couldn't create RFC");
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
        const note = document.getElementById('Description')?.value ?? '';

        return { formData, note };
    }

    async _submitRFC(formData) {
        return API.post('RFC/SaveRFC',
            API.authPayload({
                ...formData,
                emailSent: 0
            })
        );
    }

    // -------------------------  Create Success  ------------------------- //

    async _handleCreateSuccess(data, note) {
        const newRfcId = data.id ?? data.rfcId;
        const message = data.message ?? 'Created';

        // The description becomes the RFC's first note, now CARRYING the
        // attachments (previously null was passed and files were lost).
        await SaveOriginalNote(this.files, true, note, newRfcId);

        const assignedTech = document.getElementById('assignedTechName');
        if (assignedTech?.selectedIndex >= 0) {
            const techId = assignedTech.options[assignedTech.selectedIndex].value;
            const techEmail = GetUserEmailAddress(techId);
            CreateAndSendEmail(newRfcId, 'Assigned', 'RFC', techEmail, '', '', '', '');
        }

        BuildMessageBox(`${message} RFC ${newRfcId}`, 'RFC');
    }
}

// -------------------------  Init  ------------------------- //

const page = new CreateRFC();
document.addEventListener('DOMContentLoaded', () => page.init());
