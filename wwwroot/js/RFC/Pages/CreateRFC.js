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

        // Attachments: the paperclip label opens the native file picker; we
        // just handle the picked files and render the shared td-attach-chip.
        const fileInput = document.getElementById('cr-file-input');
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
        // Canonical attachment tiles (icon + hover popout + corner remove badge)
        // via the shared Attachments component. Pending files are removable.
        holder.replaceChildren(Attachments.render(this.files, {
            canRemove: true,
            onRemove: (file, index) => {
                this.files.splice(index, 1);
                this._renderAttachmentChips();
            },
            showSize: true,
        }));
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


        BuildMessageBox(`${message} RFC ${newRfcId}`, 'RFC');
    }
}

// -------------------------  Init  ------------------------- //

const page = new CreateRFC();
document.addEventListener('DOMContentLoaded', () => page.init());
