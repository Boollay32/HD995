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
            this._updateStatusPill();
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

        // Save (RFCSave was previously unwired)
        document.getElementById('Save-Button')?.addEventListener('click', () => rfcSave.saveRFC());

        // Pane collapse -- shared PaneShell component
        new PaneShell({
            left:  { pane: 'pane-left',  btn: 'collapse-left',  rail: 'rail-left'  },
            right: { pane: 'pane-right', btn: 'collapse-right', rail: 'rail-right' },
            storageKey: STORAGE_KEYS.RFC_PANES_COLLAPSED,
        }).init();

        // Fix: single resize listener — removed duplicate at bottom of file
        window.addEventListener('resize', () => Layout.setDetailContainerHeight());
    }

    // -------------------------  Status Change  ------------------------- //

    _handleStatusChange(statusSelect) {
        const selectedText = statusSelect.options[statusSelect.selectedIndex]?.innerText;
        const completedDate = document.getElementById('CompletedDate');
        const completedDateRow = completedDate?.parentElement?.parentElement;

        if (!completedDate || !completedDateRow) return;

        const isComplete = selectedText === 'Complete';

        completedDateRow.style.display = isComplete ? 'block' : 'none';
        completedDate.disabled = !isComplete;
        completedDate.required = isComplete;

        if (!isComplete) completedDate.value = '';

        this._updateStatusPill();
    }

    // -------------------------  Topbar pill  ------------------------- //

    _updateStatusPill() {
        const pill = document.getElementById('rfc-topbar-status');
        const select = document.getElementById('rfcStatus');
        if (!pill || !select) return;

        const label = select.selectedIndex >= 0
            ? select.options[select.selectedIndex].innerText
            : '';
        pill.textContent = label;
        pill.hidden = !label;
    }
}

// -------------------------  Init  ------------------------- //

const rfcDetails = new RFCDetails();  // Fix: stored — accessible externally

document.addEventListener('DOMContentLoaded', async () => {
    await rfcDetails.init();
});

// -------------------------  Global  ------------------------- //

if (typeof window !== 'undefined') {
    window.rfcManager = rfcDetails;
}
