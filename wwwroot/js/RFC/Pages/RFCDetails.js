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
        // Prefix with # to match the ticket header style ("Ticket #123" ->
        // "RFC #123"). HD34 4c.
        if (rfcIdEl) rfcIdEl.innerText = '#' + this.rfcId;
    }



    // -------------------------  Load Data  ------------------------- //

    async _loadRFCData() {
        // HD36 3a: load the dropdowns FIRST so #rfcStatus / #priority have their
        // <option>s before _getRFCDetails() selects the RFC's values. Previously
        // these raced in one Promise.all, so the status/priority pills rendered
        // blank when the details fetch won (setSelectByName found no options).
        await Dropdowns.load('RFC');
        await Promise.all([
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

        // Overview opens collapsed to match ticket details (collapse after
        // populate so the slim summary is filled, not blank).
        window.RFCOverview?.setCollapsed?.(true);

        // Fields are now populated -- capture the dirty baseline here so
        // Save activates only when the user actually changes something.
        this._rfcDirtyResetBaseline();
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
    const saveBtn = document.getElementById('Save-Button');
    if (!saveBtn) return;
    // Watch every editable .Value control -- the main fields AND the Extended
    // Information fields -- rather than a hardcoded id list, so the extended
    // section also activates Save (HD34 4b). Elements + baseline are collected
    // after the data populates, via _rfcDirtyResetBaseline().
    this._rfcDirtyEls = [];
    this._rfcDirtyBaseline = [];
    const refresh = () => {
        const dirty = this._rfcDirtyEls.some((el, i) => el.value !== this._rfcDirtyBaseline[i]);
        saveBtn.disabled = !dirty;
    };
    // Delegated listeners at the document level (capture phase), so every
    // .Value control dirties the form -- including the general-info fields in
    // the header panel AND the Extended Information fields in the form. This
    // mirrors RFCSave/RFCFields, which also read .Value document-wide.
    document.addEventListener('input', refresh, true);
    document.addEventListener('change', refresh, true);

    // HD44-b: grow Extended Information textareas as the user types -- they
    // only autosize to fit on load (UI.adjustTextAreas) otherwise.
    document.addEventListener('input', (e) => {
        if (e.target && e.target.tagName === 'TEXTAREA') UI.autoGrow(e.target);
    }, true);
    saveBtn.disabled = true;
};

// Re-collect the editable controls and capture their baseline from the now-
// populated fields, so 'Save Changes' activates only on a real edit. Called
// after the RFC data loads.
RFCDetails.prototype._rfcDirtyResetBaseline = function () {
    // Document-wide .Value (matching RFCSave/RFCFields): general-info fields
    // are in the header panel, Extended Information is in the form.
    this._rfcDirtyEls = Array.from(document.getElementsByClassName('Value'))
        .filter(el => 'value' in el);
    this._rfcDirtyBaseline = this._rfcDirtyEls.map(el => el.value);
    const saveBtn = document.getElementById('Save-Button');
    if (saveBtn) saveBtn.disabled = true;
};

document.addEventListener('DOMContentLoaded', async () => {
    await rfcDetails.init();
});

// -------------------------  Global  ------------------------- //

if (typeof window !== 'undefined') {
    window.rfcManager = rfcDetails;
}
