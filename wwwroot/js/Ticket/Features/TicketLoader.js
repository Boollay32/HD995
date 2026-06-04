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

            PaneLayout.init(adminLevel);
            Tabs.restore();
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

        console.log('delegating with ticketId:', ticketId);

        if (isNaN(ticketId)) {
            console.error('ticketId is NaN — check API response');
            return;
        }

        if (typeof Notes !== 'undefined') Notes.init(ticketId);
        if (typeof Tasks !== 'undefined') Tasks.init(ticketId);
        if (typeof Activity !== 'undefined') Activity.init(ticketId);

        if (typeof CustomFieldBuilder !== 'undefined') {
            const builder = new CustomFieldBuilder();
            builder.changeCustomFields(data.requestID);
        }
    }

};

