// =============================  NotificationBell.js  ============================= //
// In-app notification inbox: a bell in the nav (internal users only -- levels
// 1 and 2; clients keep the queue dots from notification Phase A) with an
// unread badge and a dropdown panel. Rows come from tblNotification via
// Notification/GetNotifications, written by NotificationService alongside its
// emails (one event pipeline, two outputs). Fetched once per page load -- no
// polling. Clicking a row marks it read and deep-links: tickets open the
// ticket, tasks open the ticket with the drawer on that task, RFCs open the
// RFC. Mount pattern mirrors Settings.js (PersistedToggle.pollMount).

'use strict';

const NotificationBell = {

    // Internal techs only -- matches the Dashboard/menu gating.
    ALLOW: new Set(['1', '2']),

    // EntityType values from NotificationStub: 1 ticket, 2 task, 3 RFC.
    ENTITY: { TICKET: 1, TASK: 2, RFC: 3 },

    BELL:
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" ' +
        'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
        'stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />' +
        '<path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>',

    _items: [],

    _wrap()  { return document.getElementById('qv-bell'); },
    _panel() { return document.getElementById('qv-bell-panel'); },
    _btn()   { return document.getElementById('qv-bell-btn'); },
    _badge() { return document.getElementById('qv-bell-badge'); },

    _gateStarted: false,

    mount() {
        const bar = document.querySelector('nav.Nav-Bar #navbar-logout');
        if (!bar) return false;
        if (NotificationBell._gateStarted) return true;
        NotificationBell._gateStarted = true;

        // Gate through the SAME source as the nav menu gating: the
        // cached-per-session admin level (Auth.getAdminLevel). The
        // login-only 'Admin' key is never populated on app pages --
        // gating on it meant the bell never mounted for anyone.
        // Clients never get the bell; resolving without building is
        // the intended outcome for them.
        Auth.getAdminLevel().then((level) => {
            if (!NotificationBell.ALLOW.has(String(level))) return;
            NotificationBell._build(bar);
        }).catch(() => { /* no level, no bell */ });
        return true;
    },

    _build(bar) {
        if (bar.querySelector('#qv-bell')) return;

        const wrap = document.createElement('div');
        wrap.className = 'qv-bell';
        wrap.id = 'qv-bell';
        wrap.innerHTML =
            '<button type="button" class="qv-bell-btn" id="qv-bell-btn" ' +
                'aria-label="Notifications" aria-haspopup="true" aria-expanded="false">' +
                NotificationBell.BELL +
                '<span class="qv-bell-badge mono hidden" id="qv-bell-badge"></span>' +
            '</button>' +
            '<div class="qv-bell-panel" id="qv-bell-panel" role="menu" hidden>' +
                '<div class="qv-bell-head">' +
                    '<span>Notifications</span>' +
                    '<button type="button" class="qv-bell-markall" id="qv-bell-markall">Mark all read</button>' +
                '</div>' +
                '<div class="qv-bell-list" id="qv-bell-list"></div>' +
            '</div>';

        bar.insertBefore(wrap,
            document.getElementById('qv-settings') || document.getElementById('Logout-button'));

        NotificationBell._bind();
        NotificationBell.load();
    },

    _bind() {
        NotificationBell._btn()?.addEventListener('click', (e) => {
            e.stopPropagation();
            NotificationBell._toggle();
        });
        document.getElementById('qv-bell-markall')
            ?.addEventListener('click', () => NotificationBell._markAll());
        document.getElementById('qv-bell-list')
            ?.addEventListener('click', (e) => NotificationBell._onRowClick(e));
        document.addEventListener('click', (e) => {
            if (!NotificationBell._wrap()?.contains(e.target)) NotificationBell._close();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') NotificationBell._close();
        });
    },

    _toggle() {
        const panel = NotificationBell._panel();
        if (!panel) return;
        const open = panel.hidden;
        panel.hidden = !open;
        NotificationBell._btn()?.setAttribute('aria-expanded', String(open));
    },

    _close() {
        const panel = NotificationBell._panel();
        if (panel && !panel.hidden) {
            panel.hidden = true;
            NotificationBell._btn()?.setAttribute('aria-expanded', 'false');
        }
    },

    // -------------------------  Data  ------------------------- //

    async load() {
        try {
            const data = await API.post('Notification/GetNotifications', API.authPayload({}));
            NotificationBell._items = Array.isArray(data?.notifications) ? data.notifications : [];
            NotificationBell._render(Number(data?.unreadCount) || 0);
        } catch (e) {
            // A bell failure must never break the page it rides on.
        }
    },

    _setBadge(n) {
        const badge = NotificationBell._badge();
        if (!badge) return;
        if (n > 0) {
            badge.textContent = n > 99 ? '99+' : String(n);
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    },

    _ago(iso) {
        const d = new Date(iso);
        if (isNaN(d)) return '';
        const m = Math.round((Date.now() - d) / 60000);
        if (m < 1) return 'just now';
        if (m < 60) return `${m}m ago`;
        const h = Math.round(m / 60);
        if (h < 24) return `${h}h ago`;
        const days = Math.round(h / 24);
        return days === 1 ? 'yesterday' : `${days}d ago`;
    },

    _render(unread) {
        NotificationBell._setBadge(unread);
        const list = document.getElementById('qv-bell-list');
        if (!list) return;

        if (!NotificationBell._items.length) {
            list.innerHTML = '<p class="qv-bell-empty">Nothing yet.</p>';
            return;
        }
        list.innerHTML = NotificationBell._items.map(n =>
            `<button type="button" class="qv-bell-row${n.readDate ? ' is-read' : ''}" ` +
                `data-id="${Number(n.notificationID)}" data-entity="${Number(n.entityType)}" ` +
                `data-eid="${Number(n.entityID)}" data-ticket="${n.ticketID != null ? Number(n.ticketID) : ''}">` +
                `<span class="qv-bell-msg">${Format.escapeHtml(n.message || '')}</span>` +
                `<span class="qv-bell-when">${NotificationBell._ago(n.created)}${n.readDate ? ' \u00b7 read' : ''}</span>` +
                (n.readDate ? '' : '<span class="qv-bell-dot" aria-hidden="true"></span>') +
            '</button>').join('');
    },

    // -------------------------  Actions  ------------------------- //

    _markAll() {
        // Fire-and-forget; reflect locally without waiting.
        API.post('Notification/MarkRead', API.authPayload({ notificationID: null })).catch(() => {});
        NotificationBell._items.forEach(n => { if (!n.readDate) n.readDate = new Date().toISOString(); });
        NotificationBell._render(0);
    },

    _onRowClick(e) {
        const row = e.target.closest('.qv-bell-row');
        if (!row) return;

        const id = Number(row.dataset.id);
        if (id) API.post('Notification/MarkRead', API.authPayload({ notificationID: id })).catch(() => {});

        const entity = Number(row.dataset.entity);
        const eid = Number(row.dataset.eid);
        const ticketId = row.dataset.ticket ? Number(row.dataset.ticket) : null;

        if (entity === NotificationBell.ENTITY.TASK && ticketId) {
            // Same flow as the Tasks queue / dashboard: land on the ticket
            // with the drawer open on Tasks and this task's editor expanded.
            sessionStorage.setItem(STORAGE_KEYS.TICKET_ID, String(ticketId));
            sessionStorage.setItem(STORAGE_KEYS.TASK_ID, String(eid));
            sessionStorage.setItem(STORAGE_KEYS.TD_ACTIVE_TAB, 'tasks');
            Router.toTicketDetails();
        } else if (entity === NotificationBell.ENTITY.RFC) {
            sessionStorage.setItem(STORAGE_KEYS.RFC_ID, String(eid));
            Router.toRFCDetails();
        } else {
            // Tickets -- and task rows without a parent ticket id fall back
            // to the ticket the event was raised against.
            const target = entity === NotificationBell.ENTITY.TICKET ? eid : (ticketId ?? eid);
            sessionStorage.setItem(STORAGE_KEYS.TICKET_ID, String(target));
            sessionStorage.removeItem(STORAGE_KEYS.TD_ACTIVE_TAB);
            Router.toTicketDetails();
        }
    },

    boot() {
        PersistedToggle.pollMount(() => NotificationBell.mount(), '#navbar-logout');
    },
};

document.addEventListener('DOMContentLoaded', () => NotificationBell.boot());
if (typeof window !== 'undefined') window.NotificationBell = NotificationBell;
