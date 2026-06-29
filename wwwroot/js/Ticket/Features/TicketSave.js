// =====================  TicketSave.js  ===================== //
// Field-change tracking, dirty state, payload build/validate, and the save POST.
// Split out of TicketDetails.js (Phase 3a). Loaded as a global; methods run
// after DOMContentLoaded so cross-file references resolve at call time.

'use strict';

// -------------------------  Dirty tracking  ------------------------- //

const Dirty = {

    set(isDirty) {
        State.isDirty = isDirty;
        const saveBtn = Dom.saveBtn();
        if (!saveBtn) return;

        // Save lives in the Overview band: always present, greyed until dirty.
        saveBtn.hidden = false;
        saveBtn.disabled = !isDirty;
        saveBtn.textContent = 'Save Changes';
        saveBtn.classList.toggle('is-dirty', isDirty);
    },

    guard() {
        if (!State.isDirty) return true;
        return window.confirm('You have unsaved changes. Leave anyway?');
    },

    // HD43 Ticket-g: snapshot editable fields after load so dirty can be
    // RE-evaluated on every change -- reverting a field to its original value
    // clears dirty (and greys Save) again, instead of latching on.
    _baseline: null,

    captureBaseline() {
        this._baseline = new Map();
        FieldHandlers._trackedControls().forEach((el) => {
            this._baseline.set(el, FieldHandlers._controlValue(el));
        });
    },

    recompute() {
        if (!this._baseline) { this.set(true); return; }  // no baseline yet -> fail safe
        let dirty = false;
        this._baseline.forEach((val, el) => {
            if (el.isConnected && FieldHandlers._controlValue(el) !== val) dirty = true;
        });
        this.set(dirty);
    },
};

// -------------------------  Field change handlers  ------------------------- //

const FieldHandlers = {

    _controlValue(el) {
        return el.type === 'checkbox' ? el.checked : el.value;
    },

    // Status / priority / category + custom fields live in the Details panel;
    // assigned-tech and target-date live in the Overview band.
    _trackedControls() {
        const set = new Set();
        const panel = document.getElementById('tabpanel-details');
        if (panel) panel.querySelectorAll('input, select, textarea').forEach((el) => set.add(el));
        ['assignedtech', 'targetdate'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) set.add(el);
        });
        return set;
    },

    _onChange() {
        Dirty.recompute();
    },

    _onAssignedTechChange(e) {
        const newTech = e.target.value;
        const oldTech = sessionStorage.getItem(STORAGE_KEYS.OLD_ASSIGNED_TECH);

        sessionStorage.setItem(STORAGE_KEYS.NEW_ASSIGNED_TECH, newTech);

        if (!oldTech) {
            sessionStorage.setItem(STORAGE_KEYS.OLD_ASSIGNED_TECH, newTech);
        }

        Dirty.recompute();
    },

    _onCategoryChange() {
        Dirty.recompute();
    },

    _onTargetDateChange(e) {
        const val = e.target.value;
        if (!val) return;

        // Validate not in the past
        const selected = new Date(val);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (selected < today) {
            UI.toast?.('Target date cannot be in the past', 'warning');
            e.target.value = State.ticketData?.TargetDate?.split('T')[0] ?? '';
            return;
        }

        Dirty.recompute();
    },

    bind() {
        // Assigned tech
        const techEl = document.getElementById('assignedtech');
        techEl?.addEventListener('change', FieldHandlers._onAssignedTechChange);

        // Category
        const catEl = document.getElementById('category');
        catEl?.addEventListener('change', FieldHandlers._onCategoryChange);


        // Priority
        const priorityEl = document.getElementById('priority');
        priorityEl?.addEventListener('change', FieldHandlers._onChange);

        // Target date
        const targetEl = document.getElementById('targetdate');
        targetEl?.addEventListener('change', FieldHandlers._onTargetDateChange);

        // Blanket dirty-marking: any change to an editable control in the
        // Details panel (Status + the four above + custom fields) flags the
        // form dirty, so every field enables Save, not just the four with
        // bespoke handlers. Scoped to #tabpanel-details so the note/message
        // composers (in other panels) don't trigger it. #targetdate is
        // skipped because its own handler validates before marking dirty.
        const detailsPanel = document.getElementById('tabpanel-details');
        if (detailsPanel) {
            const markDirty = (e) => {
                if (e.target.id === 'targetdate') return;
                if (e.target.matches('input, select, textarea')) Dirty.recompute();
            };
            detailsPanel.addEventListener('change', markDirty);
            detailsPanel.addEventListener('input', markDirty);
        }
    },
};

// -------------------------  Save  ------------------------- //

const Save = {

    _buildPayload() {
        const data = State.ticketData;
        if (!data) return null;

        // Real ID matters: a missing TicketID makes SaveTicket take the INSERT
        // path and create a duplicate ticket. Fall back with || so an empty
        // select ('') uses the existing value instead of blanking it.
        return {
            TicketID: data.ticketID,
            StatusID: document.getElementById('status')?.value || data.status,
            AssignedTechID: document.getElementById('assignedtech')?.value || data.assignedTechID,
            CategoryID: document.getElementById('category')?.value || data.category,
            PriorityID: document.getElementById('priority')?.value || data.priority,
            TargetDate: document.getElementById('targetdate')?.value || data.targetDate,
            NewAssignedTech: sessionStorage.getItem(STORAGE_KEYS.NEW_ASSIGNED_TECH) ?? null,
            OldAssignedTech: sessionStorage.getItem(STORAGE_KEYS.OLD_ASSIGNED_TECH) ?? null,
        };
    },

    _validate(payload) {
        if (!payload.AssignedTechID) {
            UI.toast?.('Please assign a technician', 'warning');
            return false;
        }
        if (!payload.CategoryID) {
            UI.toast?.('Please select a category', 'warning');
            return false;
        }
        return true;
    },

    async _post(payload, falseReply = false) {
        // Keys must match TicketMapper.Map.
        const parts = [
            `TicketID\`${payload.TicketID}`,
            `status\`${payload.StatusID ?? ''}`,
            `assignedTechName\`${payload.AssignedTechID ?? ''}`,
            `category\`${payload.CategoryID ?? ''}`,
            `priority\`${payload.PriorityID ?? ''}`,
            `targetDate\`${payload.TargetDate ?? ''}`,
        ].filter(s => !s.endsWith('`'));

        // Append custom-field values so edits to the Additional Info section
        // persist. Each custom field built by CustomFieldBuilder has
        // id === customFilterItem (the camelCase Ticket property name), so
        // TicketMapper saves them by name — the same mechanism CreateTicket
        // uses for custom fields on a new ticket.
        const customContainer = document.querySelector('#CustomFields-Container')
            || document.querySelector('#Custom-fields');
        if (customContainer) {
            // TicketMapper.Map builds an OrdinalIgnoreCase dictionary and throws
            // ("same key ... Webform") if a field id repeats. Track keys already
            // emitted (incl. the standard fields above) and keep the first one.
            const SEP = String.fromCharCode(96);
            const seen = new Set(parts.map(p => p.split(SEP)[0].toLowerCase()));
            for (const el of customContainer.querySelectorAll('input, select, textarea')) {
                if (!el.id) continue;
                const _key = el.id.toLowerCase();
                if (seen.has(_key)) continue;
                const val = (el.type === 'checkbox') ? (el.checked ? '1' : '0') : el.value;
                if (val === null || val === undefined || val === '') continue;
                seen.add(_key);
                parts.push(`${el.id}\`${val}`);
            }
        }

        const objectInfo = parts.join('|');

        const data = await API.post(
            'Ticket/SaveTicket',
            API.authPayload({
                objectInfo,
                falseReply,
                emailSent: 0,
                newAssignedTech: payload.NewAssignedTech ?? null,
                oldAssignedTech: payload.OldAssignedTech ?? null,
            })
        );

        if (!data) throw new Error('SaveTicket returned null');
        return data;
    },

    // Email the ticket's watchers after a save. Ported from the old


    async execute() {
        const saveBtn = Dom.saveBtn();
        if (!saveBtn) return;

        const payload = Save._buildPayload();
        if (!payload) {
            UI.toast?.('Nothing to save yet - the ticket is still loading', 'warning');
            return;
        }
        if (!Save._validate(payload)) return;

        // Loading state
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving…';

        try {
            const data = await Save._post(payload);

            // Success
            Dirty.set(false);
            Dirty.captureBaseline();   // saved values are the new baseline
            UI.toast?.('Ticket saved', 'success');

            // brief success pulse on the Save button (point-of-action cue)
            saveBtn.classList.remove('saved-flash');
            void saveBtn.offsetWidth;
            saveBtn.classList.add('saved-flash');
            setTimeout(() => saveBtn.classList.remove('saved-flash'), 700);

            // Reflect the saved priority in the topbar pill
            Topbar.populate({
                ...State.ticketData,
                priority: payload.PriorityID,
            });

            // Clear assigned tech session keys
            sessionStorage.removeItem(STORAGE_KEYS.NEW_ASSIGNED_TECH);
            sessionStorage.removeItem(STORAGE_KEYS.OLD_ASSIGNED_TECH);

        } catch (err) {
            console.error('Save.execute:', err);
            UI.toast?.('Failed to save ticket', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = State.isDirty ? 'Save Changes' : 'Save';
        }
    },

    // Persist a "false reply": re-save the current ticket with the falseReply
    // flag so the server clears Notify/NotifyTech (otherwise the notification
    // banner returns on the next load). Silent — no spinner, toast, or email.
    // NOTE: verify against the live save — can't be exercised from here.
    async markFalseReply() {
        const payload = Save._buildPayload();
        if (!payload) return;
        try {
            await Save._post(payload, true);
        } catch (err) {
            console.error('Save.markFalseReply:', err);
        }
    },

    bind() {
        Dom.saveBtn()?.addEventListener('click', Save.execute);
    },
};

