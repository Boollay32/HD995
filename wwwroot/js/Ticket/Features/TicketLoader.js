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

            // Project tickets and incidents (request type 8) get a Notes pane
            // on the left (NotesPanel) in place of the client Messages thread,
            // and drop the Workspace Notes tab. Decide before layout + restore.
            State.notesLeft = !!data.projectID || Number(data.requestID) === 8;
            if (State.notesLeft) NotesLeft.prepare();

            // Populate the Details-tab selects (assignedtech / category /
            // subcategory / priority). REQUEST_TYPE is set above so the
            // status CR-filter in Dropdowns can use it.
            await Dropdowns.load('Ticket');

            PaneLayout.init(adminLevel);

            // HD35 B7: a client sees ONLY the Details tab. Hide Tasks/Notes/
            // Activity (buttons + panels) before Tabs.restore() so the tab
            // machinery treats them as absent (Tabs._visibleTabs ignores
            // [hidden]); Details stays the active tab.
            if (State.clientView) {
                ['tab-tasks', 'tab-notes', 'tab-activity',
                 'tabpanel-tasks', 'tabpanel-notes', 'tabpanel-activity']
                    .forEach(function (id) {
                        document.getElementById(id)?.setAttribute('hidden', '');
                    });
                // Lock the overview's editable controls (Assigned to / Needed by) so a
                // client cannot edit the overview either -- mirrors the server-side data
                // lock in SaveTicket. Replies and the Resolved status pill are unaffected.
                document.querySelectorAll('#Ticket-Overview input, #Ticket-Overview select, #Ticket-Overview textarea')
                    .forEach(function (el) { el.setAttribute('disabled', ''); });
            }

            Tabs.restore();

            // Start Messages collapsed to its rail (still reachable) when the
            // user has no saved pane preference and either they arrived on the
            // Tasks tab, or the ticket is internal (no client thread).
            // HD35 B4/B7: never auto-collapse Messages for a client -- the
            // conversation is their primary pane. (Clients now get layout=BOTH,
            // so without this guard an internal-request-type ticket would trip
            // the Session.isInternal branch and collapse their Messages pane.)
            if (!State.clientView
                && State.layout === TDLAYOUT.BOTH
                && !State.notesLeft
                && !sessionStorage.getItem(STORAGE_KEYS.TD_PANES_COLLAPSED)
                && (State.activeTab === 'tasks' || Session.isInternal)) {
                Collapse._shell?.collapse?.('left');
            }
            Topbar.populate(data);
            Fields.populate(data);
            // HD35 B4: in client view, PillEdit makes ONLY the status pill
            // interactive (Resolved-only); priority/category become plain
            // labels. Internal view is unchanged (all pills editable).
            window.PillEdit?.init?.({ clientView: State.clientView });
            // 1b: overview opens collapsed (after populate so the slim
            // summary is filled, not blank).
            window.OverviewPanel?.setCollapsed?.(true);
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

        if (State.notesLeft) {
            NotesLeft.init(ticketId);
        } else {
            if (typeof Notes !== 'undefined') Notes.init(ticketId);
            MessagesLeft.init(ticketId, State.adminLevel);
        }
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
                .then(() => {
                    // HD35 B4: the Extended Information inputs are read-only for
                    // a client. Disable them HERE (not earlier) because the
                    // custom fields are built asynchronously above -- doing it
                    // before this resolves would find no fields to disable.
                    if (State.clientView) {
                        var cf = document.getElementById('CustomFields-Container');
                        if (cf) {
                            cf.querySelectorAll('input, select, textarea')
                                .forEach(function (el) { el.setAttribute('disabled', ''); });
                        }
                    }

                    // HD36 1d: when Extended Information is empty there is nothing
                    // to show in the group -- hide it. For a client (whose Details
                    // tab is the only Workspace tab), an empty group means the whole
                    // Workspace is empty.
                    // HD39 1b: clients START in LEFT_ONLY (messages-only) to avoid
                    // flashing the Workspace before this async check; reveal BOTH only
                    // when it has content. If the field fetch fails, no fields build
                    // -> empty -> staying messages-only is correct.
                    var cfContainer = document.getElementById('CustomFields-Container');
                    var isEmpty = !cfContainer || cfContainer.children.length === 0;
                    var detailsEmpty = document.getElementById('Details-Empty');
                    if (isEmpty) {
                        document.getElementById('CustomFields-Group')
                            ?.setAttribute('hidden', '');
                        // Show the "no extra details" empty state in the Details tab.
                        detailsEmpty?.removeAttribute('hidden');
                    } else {
                        detailsEmpty?.setAttribute('hidden', '');
                        if (State.clientView) {
                            PaneLayout.apply(TDLAYOUT.BOTH);
                        }
                    }
                })
                .catch(err => console.error('Custom-field dropdown load:', err));
        }
    }

};

// -------------------------  Notes-on-left (project / incident)  ------------------------- //
// Project tickets and incidents have no client thread, so the left pane becomes
// a NotesPanel bound to the ticket's own internal notes, and the Workspace Notes
// tab is dropped. prepare() does the DOM swap before layout/tab restore; init()
// starts the panel after the fetch (skipping the client Messages pane + the right-tab Notes).
const NotesLeft = {

    prepare() {
        // Project/incident tickets reuse the Messages dock as an internal
        // Notes pane (one shared td-composer-dock; NotesPanel is a singleton,
        // so only one of Messages/Notes initialises per page). Relabel + retune
        // the composer copy rather than swapping in a separate block.
        document.getElementById('msg-scope-banner')?.setAttribute('hidden', '');

        const ta = document.getElementById('msg-textarea');
        if (ta) { ta.placeholder = 'Add an internal note'; ta.setAttribute('aria-label', 'Note text'); }
        document.getElementById('msg-send-btn')?.setAttribute('aria-label', 'Save note');

        const title = document.querySelector('#pane-left .td-pane-title');
        if (title) title.textContent = 'Notes';
        const railLabel = document.querySelector('#rail-left .td-rail-label');
        if (railLabel) railLabel.textContent = 'Notes';
        document.getElementById('pane-left')?.setAttribute('aria-label', 'Notes');
        document.getElementById('collapse-left')?.setAttribute('aria-label', 'Collapse notes pane');

        // Drop the Workspace Notes tab + its panel.
        document.getElementById('tab-notes')?.setAttribute('hidden', '');
        document.getElementById('tabpanel-notes')?.setAttribute('hidden', '');

        // Never restore onto the now-hidden Notes tab.
        if (sessionStorage.getItem(STORAGE_KEYS.TD_ACTIVE_TAB) === 'notes') {
            sessionStorage.setItem(STORAGE_KEYS.TD_ACTIVE_TAB, 'details');
        }
    },

    init(ticketId) {
        if (typeof NotesPanel === 'undefined') return;
        NotesPanel.init({
            ownerId: parseInt(ticketId, 10),
            ownerField: 'TicketID',
            getEndpoint: 'TicketDetails/GetNotes',
            getPayloadKey: 'ticketId',
            attachmentOwnerType: 0,
            rfc: false,
            extraSaveFields: { visibleToClient: '0' },
            ids: {
                thread: 'Messages-Thread',
                textarea: 'msg-textarea',
                sendBtn: 'msg-send-btn',
                charcount: 'msg-charcount',
                fileInput: 'msg-file-input',
                attachList: 'msg-attachment-list',
                composerDock: 'Messages-Compose',
            },
        });
    },

};


// Client-ticket left pane: the shared NotesPanel in messages mode -- GetNotes
// filtered to client-visible items, the earliest pinned as the overview
// Description, new items sent client-visible. Replaces the old MessagePanel so
// messages and notes share one component. The Govtech-only scope banner is
// passed (and thus shown) only at adminLevel >= 1.
const MessagesLeft = {

    init(ticketId, adminLevel) {
        if (typeof NotesPanel === 'undefined') return;
        NotesPanel.init({
            ownerId: parseInt(ticketId, 10),
            ownerField: 'TicketID',
            getEndpoint: 'TicketDetails/GetNotes',
            getPayloadKey: 'ticketId',
            attachmentOwnerType: 0,
            rfc: false,
            extraSaveFields: { visibleToClient: '1' },
            filter: n => n.visibleToClient === true,
            pinDescription: true,
            noun: 'message',
            scope: Number(adminLevel) >= 1
                ? { banner: 'msg-scope-banner', dismiss: 'msg-scope-dismiss', dismissKey: 'td-msg-scope-dismissed' }
                : null,
            ids: {
                thread: 'Messages-Thread',
                textarea: 'msg-textarea',
                sendBtn: 'msg-send-btn',
                charcount: 'msg-charcount',
                fileInput: 'msg-file-input',
                attachList: 'msg-attachment-list',
                composerDock: 'Messages-Compose',
            },
        });
    },

};
