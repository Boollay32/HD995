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

        if (isDirty) {
            saveBtn.classList.add('is-dirty');
            saveBtn.textContent = 'Save Changes';
        } else {
            saveBtn.classList.remove('is-dirty');
            saveBtn.textContent = 'Save';
        }
    },

    guard() {
        if (!State.isDirty) return true;
        return window.confirm('You have unsaved changes. Leave anyway?');
    },
};

// -------------------------  Field change handlers  ------------------------- //

const FieldHandlers = {

    _onChange() {
        Dirty.set(true);
    },

    _onAssignedTechChange(e) {
        const newTech = e.target.value;
        const oldTech = sessionStorage.getItem(STORAGE_KEYS.OLD_ASSIGNED_TECH);

        sessionStorage.setItem(STORAGE_KEYS.NEW_ASSIGNED_TECH, newTech);

        if (!oldTech) {
            sessionStorage.setItem(STORAGE_KEYS.OLD_ASSIGNED_TECH, newTech);
        }

        Dirty.set(true);
    },

    _onCategoryChange() {
        const categoryId = document.getElementById('category')?.value;
        if (!categoryId) return;

        // Delegate to existing subcategory loader
        if (typeof LoadSubCategories !== 'undefined') {
            LoadSubCategories(categoryId);
        }

        Dirty.set(true);
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

        Dirty.set(true);
    },

    bind() {
        // Assigned tech
        const techEl = document.getElementById('assignedtech');
        techEl?.addEventListener('change', FieldHandlers._onAssignedTechChange);

        // Category
        const catEl = document.getElementById('category');
        catEl?.addEventListener('change', FieldHandlers._onCategoryChange);

        // Sub category
        const subCatEl = document.getElementById('subcategory');
        subCatEl?.addEventListener('change', FieldHandlers._onChange);

        // Priority
        const priorityEl = document.getElementById('priority');
        priorityEl?.addEventListener('change', FieldHandlers._onChange);

        // Target date
        const targetEl = document.getElementById('targetdate');
        targetEl?.addEventListener('change', FieldHandlers._onTargetDateChange);
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
            AssignedTechID: document.getElementById('assignedtech')?.value || data.assignedTechID,
            CategoryID: document.getElementById('category')?.value || data.category,
            SubCategoryID: document.getElementById('subcategory')?.value || '',
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

    async _post(payload) {
        // Keys must match TicketMapper.Map. NOTE: 'subcategory' is sent but the
        // mapper does not read it and the Ticket model has no SubCategory field,
        // so it is not persisted yet — add both if you need it saved.
        const objectInfo = [
            `TicketID\`${payload.TicketID}`,
            `assignedTechName\`${payload.AssignedTechID ?? ''}`,
            `category\`${payload.CategoryID ?? ''}`,
            `subcategory\`${payload.SubCategoryID ?? ''}`,
            `priority\`${payload.PriorityID ?? ''}`,
            `targetDate\`${payload.TargetDate ?? ''}`,
        ].filter(s => !s.endsWith('`')).join('|');

        const data = await API.post(
            'Ticket/SaveTicket',
            API.authPayload({
                objectInfo,
                falseReply: false,
                emailSent: 0,
                newAssignedTech: payload.NewAssignedTech ?? null,
                oldAssignedTech: payload.OldAssignedTech ?? null,
            })
        );

        if (!data) throw new Error('SaveTicket returned null');
        return data;
    },


    async execute() {
        const saveBtn = Dom.saveBtn();
        if (!saveBtn) return;

        const payload = Save._buildPayload();
        if (!payload) return;
        if (!Save._validate(payload)) return;

        // Loading state
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving…';

        try {
            await Save._post(payload);

            // Success
            Dirty.set(false);
            UI.toast?.('Ticket saved', 'success');

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

    bind() {
        Dom.saveBtn()?.addEventListener('click', Save.execute);
    },
};

