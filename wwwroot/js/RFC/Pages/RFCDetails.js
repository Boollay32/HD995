// =============================  RFCDetails.js  ============================= //

class RFCDetails extends PageBase {

    constructor() {
        super();
        this.rfcId = sessionStorage.getItem(STORAGE_KEYS.RFC_ID)
            ?? sessionStorage.getItem(STORAGE_KEYS.TICKET_ID);
        this.customFieldBuilder = new CustomFieldBuilder();
    }

    // -------------------------  Init  ------------------------- //

    async init() {
        if (!await this.checkAuth()) return;
        try {
            this._initSessionStorage();
            this._setupEventListeners();   // listeners before async ops
            await this._loadRFCData();
            this._setupPageUI();           // UI last — DOM fully ready
        } catch (error) {
            console.error('RFC init failed:', error);
            this.handleError('Error initializing RFC details');
        }
    }

    // -------------------------  Session  ------------------------- //

    _initSessionStorage() {
        const rfcIdEl = document.getElementById('RFCID');  // Fix: null guard
        if (rfcIdEl) rfcIdEl.innerText = this.rfcId;
    }



    // -------------------------  Load Data  ------------------------- //

    async _loadRFCData() {
        await Promise.all([
            Dropdowns.load('RFC'),
            RFCNotes.init(this.rfcId),
            this._getRFCDetails()
        ]);
    }

    async _getRFCDetails() {
        const data = await RFCLoader.getDetails(this.rfcId);
        if (data) {
            FillRFCDetails(data);
            this._saveAssignedTech();
        }
    }

    _saveAssignedTech() {
        const select = document.getElementById('assignedTechName');
        if (!select || select.selectedIndex === -1) return;

        sessionStorage.setItem(
            STORAGE_KEYS.RFC_ASSIGNED_TECH,  // Fix: use STORAGE_KEYS
            select.options[select.selectedIndex].value
        );
    }

    // -------------------------  Page UI  ------------------------- //

    _setupPageUI() {
        SetActivePage('RFCMenu');
        Layout.setDetailContainerHeight();  // Fix: Layout module
        Layout.chooseSeason();              // Fix: Layout module
        Layout.displayScreen();             // Fix: Layout module
        UI.adjustTextAreas();              // Fix: UI module
        Auth.checkPermissions();           // Fix: Auth module

        this._setupBackButton();

        const description = document.getElementById('Description');
        sessionStorage.setItem(
            STORAGE_KEYS.INITIAL_NOTE_TEXT,
            description?.value ?? ''
        );

        SetCurrentAssignedTech('assignedTechName');

        // Editable Status/Priority pills + overview collapse, now that the
        // dropdowns are loaded and the fields are populated.
        RFCPillEdit.init();
        RFCOverview.init();
        this._syncTargetPill();
    }

    _setupBackButton() {
        const rfcMenu = document.getElementById('RFCMenu');
        const backButton = document.getElementById('Back-Button');
        if (rfcMenu?.style.display === 'none' && backButton) {
            backButton.style.display = 'block';
        }
    }

    // -------------------------  Event Listeners  ------------------------- //

    _setupEventListeners() {
        document.getElementById('rfcStatus')?.addEventListener('change', e => {
            this._handleStatusChange(e.target);
        });

        document.getElementById('TargetDate')?.addEventListener('change', () => {
            this._syncTargetPill();
        });

        // Save (RFCSave was previously unwired)
        document.getElementById('Save-Button')?.addEventListener('click', () => rfcSave.saveRFC());

        // Save Changes is active only when an editable field changes
        // (same principle as Ticket Details). Fields are populated by
        // RFCFields before this runs.
        this._wireRfcDirty();

        // Pane collapse + draggable split -- shared PaneShell component
        // (same slider as Ticket Details; hard-clamped to 30/70).
        const shell = new PaneShell({
            left:  { pane: 'pane-left',  btn: 'collapse-left',  rail: 'rail-left'  },
            right: { pane: 'pane-right', btn: 'collapse-right', rail: 'rail-right' },
            storageKey: STORAGE_KEYS.RFC_PANES_COLLAPSED,
        });
        shell.init();
        shell.initResize({
            shell: 'RFC-Shell',
            divider: 'pane-divider',
            colsKey: STORAGE_KEYS.RFC_SHELL_COLS,
        });

        // Fix: single resize listener — removed duplicate at bottom of file
        window.addEventListener('resize', () => Layout.setDetailContainerHeight());
    }

    // -------------------------  Status Change  ------------------------- //

    _handleStatusChange(statusSelect) {
        const selectedText = statusSelect.options[statusSelect.selectedIndex]?.innerText;
        const completedDate = document.getElementById('CompletedDate');
        const completedDateRow = document.getElementById('CompletedDate-Cell');

        if (!completedDate || !completedDateRow) return;

        const isComplete = selectedText === 'Complete';

        completedDateRow.style.display = isComplete ? '' : 'none';
        completedDate.disabled = !isComplete;
        completedDate.required = isComplete;

        if (!isComplete) completedDate.value = '';
    }

    // -------------------------  Topbar pill  ------------------------- //

    _syncTargetPill() {
        const pill = document.getElementById('meta-target');
        const input = document.getElementById('TargetDate');
        if (!pill) return;
        pill.textContent = (input && input.value) ? input.value : '';
    }
}

// -------------------------  Init  ------------------------- //

const rfcDetails = new RFCDetails();  // Fix: stored — accessible externally

RFCDetails.prototype._wireRfcDirty = function () {
    const ids = ['assignedTechName', 'rfcStatus', 'priority', 'TargetDate', 'Description'];
    const els = ids.map(id => document.getElementById(id)).filter(Boolean);
    const saveBtn = document.getElementById('Save-Button');
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
};

document.addEventListener('DOMContentLoaded', async () => {
    await rfcDetails.init();
});

// -------------------------  Global  ------------------------- //

if (typeof window !== 'undefined') {
    window.rfcManager = rfcDetails;
}
