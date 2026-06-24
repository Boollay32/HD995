// =====================  TicketDetails.js  ===================== //

'use strict';

// -------------------------  Constants  ------------------------- //

const INTERNAL_REQUEST_TYPES = [4, 8, 10, 11, 14];

const TDLAYOUT = {
    BOTH: 'both',
    LEFT_ONLY: 'left-only',
    RIGHT_ONLY: 'right-only',
};

const TAB = {
    NOTES: 'notes',
    TASKS: 'tasks',
    DETAILS: 'details',
    ACTIVITY: 'activity',
};

// -------------------------  Session  ------------------------- //

const Session = {
    get userId() { return sessionStorage.getItem(STORAGE_KEYS.USER_ID); },
    get ticketId() { return sessionStorage.getItem(STORAGE_KEYS.TICKET_ID); },
    get requestTypeId() { return parseInt(sessionStorage.getItem(STORAGE_KEYS.REQUEST_TYPE) ?? '0', 10); },
    get isInternal() { return INTERNAL_REQUEST_TYPES.includes(Session.requestTypeId); }
};


// -------------------------  State  ------------------------- //

const State = {
    layout: TDLAYOUT.BOTH,
    activeTab: TAB.DETAILS,
    collapsed: { left: false, right: false },
    ticketData: null,
    adminLevel: 0,
    isDirty: false,
    // HD35 B4/B7: a client (adminLevel < 1) gets the Workspace Details tab
    // (read-only) alongside Messages, with the other tabs hidden. Set in
    // PaneLayout.resolve; consumed by TicketLoader (tabs + field lockdown).
    clientView: false,
};


// -------------------------  DOM refs  ------------------------- //

const Dom = {
    app: () => document.getElementById('TicketDetails-App'),
    shell: () => document.getElementById('TD-Shell'),
    saveBtn: () => document.getElementById('Save-Button'),
    backBtn: () => document.getElementById('Back-Button'),
    falseReplyBtn: () => document.getElementById('FalseReply'),

    // Topbar
    ticketId: () => document.getElementById('TicketID'),
    subject: () => document.getElementById('subject'),
    metaStatus: () => document.getElementById('meta-status'),
    metaPriority: () => document.getElementById('meta-priority'),
    metaSla: () => document.getElementById('meta-sla'),

    // Panes
    paneLeft: () => document.getElementById('pane-left'),
    paneRight: () => document.getElementById('pane-right'),
    collapseLeft: () => document.getElementById('collapse-left'),
    collapseRight: () => document.getElementById('collapse-right'),
    railLeft: () => document.getElementById('rail-left'),
    railRight: () => document.getElementById('rail-right'),
    railLeftPip: () => document.getElementById('rail-left-pip'),

    // Tabs
    tabs: () => document.querySelectorAll('[role="tab"]'),
    tabPanels: () => document.querySelectorAll('[role="tabpanel"]'),
    tab: (name) => document.getElementById(`tab-${name}`),
    panel: (name) => document.getElementById(`tabpanel-${name}`),

    // Messages
    thread: () => document.getElementById('Messages-Thread'),
    msgTextarea: () => document.getElementById('msg-textarea'),
    msgSendBtn: () => document.getElementById('msg-send-btn'),
    msgCharcount: () => document.getElementById('msg-charcount'),
    msgUnreadBadge: () => document.getElementById('msg-unread-badge'),

    // Notes
    noteThread: () => document.getElementById('Notes-Thread'),
    noteTextarea: () => document.getElementById('note-textarea'),
    noteSendBtn: () => document.getElementById('note-send-btn'),
    noteCharcount: () => document.getElementById('note-charcount'),
    noteVisBtn: () => document.getElementById('note-visibility-btn'),
};

// -------------------------  Layout init  ------------------------- //

const PaneLayout = {

    resolve(adminLevel) {
        const isAdmin = adminLevel >= 1;
        const { isInternal } = Session;

        // HD35 B4/B7: clients are NO LONGER LEFT_ONLY. They get BOTH panes so
        // the Workspace Details tab (with the Extended Information they
        // submitted) is visible -- but read-only, and with only that tab.
        // clientView drives the tab-hiding + field lockdown in TicketLoader.
        if (!isAdmin) {
            State.clientView = true;
            return TDLAYOUT.BOTH;
        }
        State.clientView = false;
        // Internal tickets keep the Messages pane PRESENT (started collapsed
        // to its rail by TicketLoader) rather than hidden, so the rail is
        // always visible even when there is no client thread.
        return TDLAYOUT.BOTH;
    },

    init(adminLevel) {
        const layout = PaneLayout.resolve(adminLevel);
        PaneLayout.apply(layout);
    },

    apply(layout) {
        State.layout = layout;
        const shell = Dom.shell();
        if (!shell) return;

        shell.dataset.layout = layout;

        const paneRight = Dom.paneRight();
        const paneLeft = Dom.paneLeft();

        if (layout === TDLAYOUT.LEFT_ONLY) {
            paneRight?.setAttribute('hidden', '');
            paneLeft?.removeAttribute('hidden');
        } else if (layout === TDLAYOUT.RIGHT_ONLY) {
            paneLeft?.setAttribute('hidden', '');
            paneRight?.removeAttribute('hidden');
        } else {
            paneLeft?.removeAttribute('hidden');
            paneRight?.removeAttribute('hidden');
        }
    },
};

// -------------------------  Boot  ------------------------- //

document.addEventListener('DOMContentLoaded', () => {
    // Layout depends on the ticket's request type, which we don't have yet.
    // Bind handlers now; resolve layout + restore tab after the fetch (load()).
    Events.bind();
    NotifyBanner.check();
    TicketLoader.load();
});


// -------------------------  Events (master bind)  ------------------------- //

const Events = {
    bind() {
        Save.bind();
        BackButton.bind();
        UnloadGuard.bind();
        FieldHandlers.bind();   // was missing — editing fields did nothing
        Tabs.init();
        Collapse.init();
        NotifyBanner.bind();
        TicketComposer.init();
    },
};
