// =====================  TicketShell.js  ===================== //
// Page chrome: tabs, pane collapse, notification banner, composer, back/unload guards.
// Split out of TicketDetails.js (Phase 3a). Loaded as a global; methods run
// after DOMContentLoaded so cross-file references resolve at call time.

'use strict';

// -------------------------  Tabs  ------------------------- //

const Tabs = {

    activate(name) {
        State.activeTab = name;

        // Opening the Notes or Tasks tab clears that tab's unread pip.
        if ((name === 'notes' || name === 'tasks') && typeof TicketPips !== 'undefined') {
            const tid = Session.ticketId;
            if (tid) TicketPips.clear(tid, name === 'tasks' ? 'task' : 'note');
        }

        Dom.tabs().forEach(tab => {
            const isActive = tab.id === `tab-${name}`;
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
            tab.tabIndex = isActive ? 0 : -1;
        });

        Dom.tabPanels().forEach(panel => {
            const isActive = panel.id === `tabpanel-${name}`;
            if (isActive) {
                panel.removeAttribute('hidden');
            } else {
                panel.setAttribute('hidden', '');
            }
        });

        // NOTE: we deliberately do NOT persist the active tab to session on
        // every switch. TD_ACTIVE_TAB is a one-shot "open this ticket on this
        // tab" signal set only by the Tasks queue; persisting it here leaked the
        // last-used tab onto the NEXT ticket opened from the queue (HD34 1a).
        // The live tab is held in State.activeTab (in-memory) for this page.

        // The Save button belongs to the Details tab: show it only there,
        // and only when there are unsaved changes. Dirty state is preserved
        // across tab switches, so it reappears on returning to Details.
        Tabs.applySaveVisibility();

        // Keep the drawer header in step when sections switch via the rail.
        window.TicketDrawer?.setTitle?.(name);
    },

    applySaveVisibility() {
        const saveBtn = Dom.saveBtn();
        if (!saveBtn) return;
        // Save lives in the Overview band: always present, greyed until dirty.
        saveBtn.hidden = false;
        saveBtn.disabled = !State.isDirty;
        saveBtn.textContent = 'Save Changes';
        saveBtn.classList.toggle('is-dirty', State.isDirty);
    },

    restore() {
        // Default: open a ticket on the Details tab, and don't carry the
        // last-used tab across tickets. EXCEPTION: when something opened the
        // ticket with an explicit target tab (e.g. the Tasks queue opens a
        // task on its parent ticket's Tasks tab), honour it once, then clear
        // the key so it doesn't persist to the next ticket.
        const requested = sessionStorage.getItem(STORAGE_KEYS.TD_ACTIVE_TAB);
        sessionStorage.removeItem(STORAGE_KEYS.TD_ACTIVE_TAB);
        if (requested && requested !== TAB.DETAILS
            && Tabs._visibleTabs().includes(requested)) {
            Tabs.activate(requested);
            // An explicit target tab (e.g. the Tasks queue) means the user
            // came to work in that section -- open the drawer onto it.
            window.TicketDrawer?.open?.(requested);
            return;
        }
        Tabs.activate(TAB.DETAILS);
    },

    // Returns ordered list of visible tab names
    _visibleTabs() {
        return [...Dom.tabs()]
            .filter(t => !t.closest('[hidden]') && t.offsetParent !== null)
            .map(t => t.id.replace('tab-', ''));
    },

    _focusTab(name) {
        const el = Dom.tab(name);
        if (el) el.focus();
    },

    // Arrow key navigation — ARIA tabs pattern
    _onKeydown(e) {
        const visible = Tabs._visibleTabs();
        const current = State.activeTab;
        const idx = visible.indexOf(current);

        let next = null;

        switch (e.key) {
            case 'ArrowRight':
            case 'ArrowDown':   // vertical rail
                next = visible[(idx + 1) % visible.length];
                break;
            case 'ArrowLeft':
            case 'ArrowUp':     // vertical rail
                next = visible[(idx - 1 + visible.length) % visible.length];
                break;
            case 'Home':
                next = visible[0];
                break;
            case 'End':
                next = visible[visible.length - 1];
                break;
            case 'Enter':
            case ' ':
                Tabs.activate(current);
                return;
            default:
                return;
        }

        e.preventDefault();

        if (next) {
            Tabs.activate(next);
            Tabs._focusTab(next);
        }
    },

    bindKeys() {
        const tablist = document.querySelector('[role="tablist"]');
        if (!tablist) return;
        tablist.addEventListener('keydown', Tabs._onKeydown);
    },

    bindClicks() {
        Dom.tabs().forEach(tab => {
            tab.addEventListener('click', () => {
                const name = tab.id.replace('tab-', '');
                // Rail semantics: re-clicking the active section's icon while
                // the drawer is open closes it; anything else activates the
                // section and opens the drawer onto it. (Replaces HD34 2d's
                // reclick-reloads-Tasks: closing the drawer is the escape
                // hatch now.)
                if (State.activeTab === name && window.TicketDrawer?.isOpen?.()) {
                    window.TicketDrawer.close();
                    return;
                }
                Tabs.activate(name);
                window.TicketDrawer?.open?.(name);
            });
        });
    },

    // Pip (badge) helpers
    setPip(tabName, count) {
        const pip = document.getElementById(`${tabName}-pip`);
        if (!pip) return;

        if (count > 0) {
            pip.textContent = count > 99 ? '99+' : count;
            pip.classList.remove('hidden');
        } else {
            pip.classList.add('hidden');
        }
    },

    clearPip(tabName) {
        Tabs.setPip(tabName, 0);
    },

    init() {
        Tabs.bindClicks();
        Tabs.bindKeys();
        // Tabs.restore() is called from TicketLoader.load(), after layout.
    },
};


// -------------------------  Back button  ------------------------- //

const BackButton = {

    bind() {
        Dom.backBtn()?.addEventListener('click', () => {
            if (!Dirty.guard()) return;

            // Clear ticket session keys
            sessionStorage.removeItem(STORAGE_KEYS.TICKET_ID);
            sessionStorage.removeItem(STORAGE_KEYS.REQUEST_TYPE);
            sessionStorage.removeItem(STORAGE_KEYS.NEW_ASSIGNED_TECH);
            sessionStorage.removeItem(STORAGE_KEYS.OLD_ASSIGNED_TECH);

            // Return to the list we came from (Incidents/Tasks/Projects/Tickets),
            // not always the main Tickets queue.
            const ret = sessionStorage.getItem('TicketListReturn') || '/TicketPage';
            sessionStorage.removeItem('TicketListReturn');
            Router._navigate(ret);
        });
    },
};

// -------------------------  Beforeunload guard  ------------------------- //

const UnloadGuard = {
    bind() {
        window.addEventListener('beforeunload', (e) => {
            if (!State.isDirty) return;
            e.preventDefault();
            e.returnValue = '';
        });
    },
};


// -------------------------  Collapse  ------------------------- //
// Thin adapter over the shared PaneShell component (Components/Shell/
// PaneShell.js), which now owns the collapse behaviour. State.collapsed is
// kept as a live reference to the shell's state object.

const Collapse = {

    _shell: null,

    init() {
        Collapse._shell = new PaneShell({
            left:  { pane: 'pane-left',  btn: 'collapse-left',  rail: 'rail-left'  },
            right: { pane: 'pane-right', btn: 'collapse-right', rail: 'rail-right' },
            storageKey: STORAGE_KEYS.TD_PANES_COLLAPSED,
        });
        State.collapsed = Collapse._shell.collapsed;   // live reference
        Collapse._shell.init();
        Collapse._shell.initResize({
            shell: 'TD-Shell',
            divider: 'pane-divider',
            colsKey: STORAGE_KEYS.TD_SHELL_COLS,
        });
    },
};

// -------------------------  Notification banner  ------------------------- //

const NotifyBanner = {

    _el: null,

    show(message) {
        NotifyBanner._remove();

        const banner = document.createElement('div');
        banner.className = 'td-notify-banner';
        banner.id = 'notify-banner';
        banner.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>${message}</span>
            <button type="button" aria-label="Dismiss notification">Dismiss</button>
        `;

        banner.querySelector('button')
            ?.addEventListener('click', NotifyBanner.dismiss);

        // Insert above thread
        const thread = Dom.thread();
        thread?.parentElement?.insertBefore(banner, thread);

        NotifyBanner._el = banner;

    },

    dismiss() {
        // Persist as a false reply so the server clears Notify/NotifyTech;
        // otherwise the banner returns on the next load. UI clears regardless.
        if (typeof Save !== 'undefined') Save.markFalseReply?.();

        NotifyBanner._remove();

        // Clear notification session keys
        sessionStorage.removeItem(STORAGE_KEYS.CURRENT_TICKET_NTFY);
        sessionStorage.removeItem(STORAGE_KEYS.CURRENT_TICKET_NTFY_TECH);
    },

    _remove() {
        NotifyBanner._el?.remove();
        NotifyBanner._el = null;
    },

    check() {
        const ntfy = sessionStorage.getItem(STORAGE_KEYS.CURRENT_TICKET_NTFY);
        const ntfyTech = sessionStorage.getItem(STORAGE_KEYS.CURRENT_TICKET_NTFY_TECH);

        if (ntfy === Session.ticketId) {
            NotifyBanner.show('The client has replied to this ticket.');
            return;
        }

        if (ntfyTech === Session.ticketId) {
            NotifyBanner.show('A technician has replied to this ticket.');
        }
    },

    bind() {
        // The topbar FalseReply button was removed with the topbar (shell
        // flip): the banner's own Dismiss button is the identical action.
    },
};

// Composer helpers used to live here (TicketComposer): a full duplicate of
// what Components/Notes/NotesPanel.js's Composer.create() already does for
// the same #msg-textarea/#note-textarea elements -- charcount, auto-grow,
// send-button state, and Enter-key handling. Both were bound at once, and
// this one's never-fixed "Enter submits" handler silently overrode the
// shared Composer.js fix (RFC, which never loaded this file, was
// unaffected). Removed rather than patched a second time.

