// =====================  TicketShell.js  ===================== //
// Page chrome: tabs, pane collapse, notification banner, composer, back/unload guards.
// Split out of TicketDetails.js (Phase 3a). Loaded as a global; methods run
// after DOMContentLoaded so cross-file references resolve at call time.

'use strict';

// -------------------------  Tabs  ------------------------- //

const Tabs = {

    activate(name) {
        State.activeTab = name;

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

        // Persist active tab in session
        sessionStorage.setItem(STORAGE_KEYS.TD_ACTIVE_TAB, name);
    },

    restore() {
        const saved = sessionStorage.getItem(STORAGE_KEYS.TD_ACTIVE_TAB);
        const valid = Object.values(TAB).includes(saved);
        Tabs.activate(valid ? saved : TAB.NOTES);
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
                next = visible[(idx + 1) % visible.length];
                break;
            case 'ArrowLeft':
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
                Tabs.activate(name);
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

            // Return to the tickets list (My-open vs All is a client-side view there)
            Nav.toTicketPage();
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

const Collapse = {

    _applyLeft(collapsed) {
        State.collapsed.left = collapsed;
        const pane = Dom.paneLeft();
        const btn = Dom.collapseLeft();
        const rail = Dom.railLeft();
        if (!pane || !btn) return;

        if (collapsed) {
            pane.classList.add('is-collapsed');
            btn.setAttribute('aria-expanded', 'false');
            rail?.removeAttribute('hidden');
        } else {
            pane.classList.remove('is-collapsed');
            btn.setAttribute('aria-expanded', 'true');
            rail?.setAttribute('hidden', '');
        }
    },

    _applyRight(collapsed) {
        State.collapsed.right = collapsed;
        const pane = Dom.paneRight();
        const btn = Dom.collapseRight();
        const rail = Dom.railRight();
        if (!pane || !btn) return;

        if (collapsed) {
            pane.classList.add('is-collapsed');
            btn.setAttribute('aria-expanded', 'false');
            rail?.removeAttribute('hidden');
        } else {
            pane.classList.remove('is-collapsed');
            btn.setAttribute('aria-expanded', 'true');
            rail?.setAttribute('hidden', '');
        }
    },

    toggleLeft() {
        Collapse._applyLeft(!State.collapsed.left);
        Collapse._persistState();
    },

    toggleRight() {
        Collapse._applyRight(!State.collapsed.right);
        Collapse._persistState();
    },

    _persistState() {
        sessionStorage.setItem(
            STORAGE_KEYS.TD_PANES_COLLAPSED,
            JSON.stringify(State.collapsed),
        );
    },

    _restoreState() {
        try {
            const saved = sessionStorage.getItem(STORAGE_KEYS.TD_PANES_COLLAPSED);
            if (!saved) return;
            const parsed = JSON.parse(saved);
            if (parsed.left) Collapse._applyLeft(true);
            if (parsed.right) Collapse._applyRight(true);
        } catch {
            // Ignore malformed session data
        }
    },

    bind() {
        Dom.collapseLeft()?.addEventListener('click', Collapse.toggleLeft);
        Dom.collapseRight()?.addEventListener('click', Collapse.toggleRight);

        // Rail click expands pane
        Dom.railLeft()?.addEventListener('click', () => {
            if (State.collapsed.left) Collapse.toggleLeft();
        });

        Dom.railRight()?.addEventListener('click', () => {
            if (State.collapsed.right) Collapse.toggleRight();
        });
    },

    init() {
        Collapse.bind();
        Collapse._restoreState();
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

        // Also show FalseReply button
        Dom.falseReplyBtn()?.classList.remove('hidden');
    },

    dismiss() {
        // Persist as a false reply so the server clears Notify/NotifyTech;
        // otherwise the banner returns on the next load. UI clears regardless.
        if (typeof Save !== 'undefined') Save.markFalseReply?.();

        NotifyBanner._remove();
        Dom.falseReplyBtn()?.classList.add('hidden');

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
        Dom.falseReplyBtn()?.addEventListener('click', NotifyBanner.dismiss);
    },
};

// -------------------------  Composer helpers  ------------------------- //

const TicketComposer = {

    _bindTextarea(textareaEl, charcountEl, sendBtnEl, limit = 2000) {
        if (!textareaEl) return;

        textareaEl.addEventListener('input', () => {
            const len = textareaEl.value.length;

            // Charcount
            if (charcountEl) {
                charcountEl.textContent = `${len} / ${limit}`;
                charcountEl.classList.toggle('is-near-limit', len >= limit * 0.85);
                charcountEl.classList.toggle('is-at-limit', len >= limit);
            }

            // Send button
            if (sendBtnEl) {
                sendBtnEl.disabled = len === 0;
            }

            // Auto-grow
            textareaEl.style.height = 'auto';
            textareaEl.style.height = `${textareaEl.scrollHeight}px`;
        });

        // Enter to send — Shift+Enter for newline
        textareaEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!sendBtnEl?.disabled) {
                    sendBtnEl?.click();
                }
            }
        });
    },

    init() {
        TicketComposer._bindTextarea(
            Dom.msgTextarea(),
            Dom.msgCharcount(),
            Dom.msgSendBtn(),
        );

        TicketComposer._bindTextarea(
            Dom.noteTextarea(),
            Dom.noteCharcount(),
            Dom.noteSendBtn(),
        );
    },
};

