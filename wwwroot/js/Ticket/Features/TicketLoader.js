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
            builder.changeCustomFields(data.requestID);
        }
    }

};

