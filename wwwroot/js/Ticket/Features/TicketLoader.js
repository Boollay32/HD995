// =====================  TicketLoader.js  ===================== //
// Fetches the ticket + admin level, then hands data to the render/feature modules.
// Split out of TicketDetails.js (Phase 3a). Loaded as a global; methods run
// after DOMContentLoaded so cross-file references resolve at call time.

'use strict';

// -------------------------  Ticket loader  ------------------------- //

const TicketLoader = {

    async load() {
        const ticketId = Session.ticketId;
        if (!ticketId) return;

        try {
            // Fetch both in parallel — no extra wait time
            const [data, adminLevel] = await Promise.all([
                TicketLoader._fetch(ticketId),
                AdminContext.resolve()
            ]);

            if (!data) return;

            State.ticketData = data;
            State.adminLevel = adminLevel; // store on State, not sessionStorage

            sessionStorage.setItem(STORAGE_KEYS.REQUEST_TYPE, data.requestID ?? 0);

            // Populate the Details-tab selects (assignedtech / category /
            // subcategory / priority). REQUEST_TYPE is set above so the
            // status CR-filter in Dropdowns can use it.
            await Dropdowns.load('Ticket');

            PaneLayout.init(adminLevel);
            Tabs.restore();

            // Start Messages collapsed to its rail (still reachable) when the
            // user has no saved pane preference and either they arrived on the
            // Tasks tab, or the ticket is internal (no client thread).
            if (State.layout === TDLAYOUT.BOTH
                && !sessionStorage.getItem(STORAGE_KEYS.TD_PANES_COLLAPSED)
                && (State.activeTab === 'tasks' || Session.isInternal)) {
                Collapse._shell?.collapse?.('left');
            }
            Topbar.populate(data);
            Fields.populate(data);
            TicketLoader._clearNotificationIfMine(data);
            TicketLoader._delegateModules(data);

        } catch (err) {
            console.error('TicketLoader.load:', err);
        }
    },


    async _fetch(ticketId) {
        const data = await API.post(
            'TicketDetails/GetTicketDetail',
            API.authPayload({ ticketId: parseInt(ticketId, 10) })
        );

        if (!data) throw new Error('GetTicketDetail returned null');
        return data;
    },

    // When the person who needs to act opens the ticket, clear its reply
    // notification to '2' (no notification). notify '0' means the client
    // responded and the assigned tech needs to act; notify '1' means an
    // internal user responded and the requester needs to act. Clearing reuses
    // the false-reply save (which now writes notify '2'). Silent + best-effort.
    _clearNotificationIfMine(data) {
        const notify = String(data.notify ?? '');
        const viewerId = Number(Session.userId);
        if (!Number.isFinite(viewerId)) return;

        const viewerIsAssignedTech = Number(data.assignedTechID) === viewerId;
        const viewerIsRequester = Number(data.raisedByID) === viewerId;

        const needsClear =
            (notify === '0' && viewerIsAssignedTech) ||
            (notify === '1' && viewerIsRequester);
        if (!needsClear) return;

        // Fire-and-forget: don't block the page load on the clear.
        try { Save?.markFalseReply?.(); } catch (err) {
            console.error('TicketLoader._clearNotificationIfMine:', err);
        }
    },

    _delegateModules(data) {
        const ticketId = parseInt(data.ticketID, 10);

        if (isNaN(ticketId)) {
            console.error('ticketId is NaN — check API response');
            return;
        }

        if (typeof Notes !== 'undefined') Notes.init(ticketId);
        if (typeof MessagesPanel !== 'undefined') MessagesPanel.init(ticketId, State.adminLevel);
        if (typeof Tasks !== 'undefined') Tasks.init(ticketId);
        if (typeof Activity !== 'undefined') Activity.init(ticketId);

        if (typeof CustomFieldBuilder !== 'undefined') {
            const builder = new CustomFieldBuilder();
            // Pass the full ticket data so the builder can populate saved
            // custom-field values (field ids match the serialized field names).
            // The custom-field <select>s are created here, AFTER the initial
            // Dropdowns.load('Ticket') ran -- so they start empty. Re-run the
            // dropdown load once they exist; _populateSelect skips already-filled
            // selects, so only the new custom ones get their options.
            Promise.resolve(builder.changeCustomFields(data.requestID, data))
                .then(() => Dropdowns.load('Ticket'))
                .catch(err => console.error('Custom-field dropdown load:', err));
        }
    }

};

