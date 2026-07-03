// =============================  DashboardPage.js  ============================= //
// Internal landing page: everything assigned to you, urgency-sorted, plus an
// oversight column for the things you're watching.
//
// Relationship rule: the FEED and the project CARDS follow the assignee/owner
// (it's your work); the RAISED list follows the creator-who-isn't-the-assignee
// (you delegated it, so you're the one chasing). Projects use numeric OwnerID /
// CreatedBy; tickets use numeric AssignedTechID + UserName (login, exact);
// tasks use numeric creator UserID; task/RFC assignee matching is by display
// name (same approach as TasksPage -- known limitation).
//
// Deadline chips are PROPORTIONAL: amber/red when the remaining time falls
// below a % of the item's own created->due timeline (DeadlineWindows.get(),
// user-configurable in Settings), so a 3-day task and a 6-month project share
// one rule. No due date, or the 1900-01-01 sentinel, renders neutral.
//
// Data: five existing list endpoints, fetched on load and on the refresh
// button only (no polling). Project cards come entirely from GetProjects --
// the stub already carries OpenTicketCount / TaskCount / DoneTaskCount /
// CompletionPct / LastUpdateDate.

'use strict';

class DashboardPage extends PageBase {

    constructor() {
        super();
        this.tickets = [];
        this.tasks = [];
        this.rfcs = [];
        this.projects = [];
    }

    // -------------------------  Init  ------------------------- //

    async init() {
        if (!await this.checkAuth()) return;
        if (typeof SetActivePage === 'function') SetActivePage('Dashboard');

        this._identity();
        document.getElementById('dash-refresh')
            ?.addEventListener('click', () => this.refresh());
        document.getElementById('dash-all-projects')
            ?.addEventListener('click', () => Router.toProjectsPage());
        this._bindRowClicks();

        await this.refresh();
    }

    _identity() {
        const norm = s => (s ?? '').trim().toLowerCase();
        this.myId = Number(sessionStorage.getItem(STORAGE_KEYS.USER_ID));
        if (Number.isNaN(this.myId)) this.myId = null;
        this.myLogin = norm(sessionStorage.getItem(STORAGE_KEYS.USER_NAME));
        const display = sessionStorage.getItem(STORAGE_KEYS.DISPLAY_NAME) || '';
        // Assignee matching for tasks/RFCs is by display name (rows carry no
        // numeric assignee id) -- match either identifier, as TasksPage does.
        this.mineKeys = new Set([this.myLogin, norm(display)].filter(Boolean));

        const hour = new Date().getHours();
        const part = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
        const first = display.split(' ')[0] || '';
        const greet = document.getElementById('dash-greet');
        if (greet) greet.textContent = first ? `${part}, ${first}` : 'Dashboard';
    }

    _isMine(name) { return this.mineKeys.has((name ?? '').trim().toLowerCase()); }

    // -------------------------  Load  ------------------------- //

    async refresh() {
        const feed = document.getElementById('dash-feed');
        feed?.setAttribute('aria-busy', 'true');

        const calls = [
            API.post('Ticket/GetTickets', API.authPayload({ myTicket: 0, filters: {} })),
            API.post('Ticket/GetIncidents', API.authPayload({ myTicket: 0, filters: {} })),
            API.post('Task/GetTasks', API.authPayload({ filters: {} })),
            API.post('RFC/GetRFCs', API.authPayload({ filters: {} })),
            API.post('Project/GetProjects', API.authPayload({ statusId: null })),
        ];
        const [tk, inc, ta, rf, pj] = await Promise.allSettled(calls);

        const arr = r => (r.status === 'fulfilled' && Array.isArray(r.value)) ? r.value : null;
        this.failed = [tk, inc, ta, rf, pj].some(r => arr(r) === null);

        // Incidents are tickets in a different suit -- tag the source so the
        // feed can badge them, then treat identically.
        const tickets = (arr(tk) || []).map(r => ({ ...r, _incident: false }));
        const incidents = (arr(inc) || []).map(r => ({ ...r, _incident: true }));
        this.tickets = tickets.concat(incidents);
        this.tasks = arr(ta) || [];
        this.rfcs = arr(rf) || [];
        this.projects = arr(pj) || [];

        this._renderAll();
        feed?.setAttribute('aria-busy', 'false');

        const sub = document.getElementById('dash-sub');
        if (sub) {
            const t = new Date();
            const hh = String(t.getHours()).padStart(2, '0');
            const mm = String(t.getMinutes()).padStart(2, '0');
            sub.textContent = (this.failed ? 'Some sources failed to load · ' : '')
                + `Updated ${hh}:${mm}`;
        }
    }

    // -------------------------  Derivation helpers  ------------------------- //

    _date(v) {
        if (!v) return null;
        const s = String(v);
        if (s.startsWith('1900-01-01') || s.startsWith('0001-01-01')) return null;
        const d = new Date(s);
        return Number.isNaN(d.getTime()) ? null : d;
    }

    _days(ms) { return ms / 86400000; }

    // Proportional deadline signal. Returns { cls, label, due, overdue, today }.
    // cls: 'red' | 'amber' | 'neutral' | 'none'.
    _deadline(createdV, dueV) {
        const due = this._date(dueV);
        if (!due) return { cls: 'none', label: '', due: null, overdue: false, today: false };

        const now = new Date();
        const endOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate(), 23, 59, 59);
        const overdue = now > endOfDue;
        const today = !overdue && now.toDateString() === due.toDateString();

        let label;
        if (overdue) {
            const d = Math.max(1, Math.floor(this._days(now - endOfDue)) + 1);
            label = `Overdue ${d}d`;
        } else if (today) {
            label = 'Today';
        } else {
            label = due.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        }

        if (overdue) return { cls: 'red', label, due, overdue, today };

        const created = this._date(createdV);
        const w = DeadlineWindows.get();
        if (created && endOfDue > created) {
            const pct = (endOfDue - now) / (endOfDue - created) * 100;
            if (pct <= w.red) return { cls: 'red', label, due, overdue, today };
            if (pct <= w.amber) return { cls: 'amber', label, due, overdue, today };
        }
        // No created date on the row: proportional maths is impossible, so
        // stay neutral until overdue (defensive -- every current source now
        // supplies both ends).
        return { cls: 'neutral', label, due, overdue, today };
    }

    _idleDays(updatedV) {
        const u = this._date(updatedV);
        if (!u) return null;
        return Math.max(0, Math.floor(this._days(Date.now() - u)));
    }

    _ticketOpen(r) {
        const s = (r.statusDesc ?? r.status ?? '').toString().toLowerCase();
        return s !== 'resolved' && s !== 'closed';
    }
    _taskOpen(r) { const s = Number(r.status); return s !== 3 && s !== 4; }
    _rfcOpen(r) {
        const s = (r.status ?? '').toString().toLowerCase();
        return !['complete', 'closed', 'rejected', 'withdrawn'].includes(s);
    }
    _projectActive(r) {
        if (this._date(r.completionDate)) return false;
        const s = (r.status ?? '').toString().toLowerCase();
        return !['complete', 'closed', 'cancelled'].includes(s);
    }

    _needsMyReply(r) {
        return r.notify === '0' && this.myId != null && Number(r.assignedTechID) === this.myId;
    }

    // -------------------------  Build feed + oversight  ------------------------- //

    _buildFeed() {
        const items = [];

        this.tickets.filter(r => this._ticketOpen(r)
            && this.myId != null && Number(r.assignedTechID) === this.myId)
            .forEach(r => items.push({
                kind: r._incident ? 'incident' : 'ticket',
                ref: `#${r.ticketID}`,
                title: r.subject || '',
                status: r.statusDesc || '',
                dl: this._deadline(r.created, r.targetDate),
                reply: this._needsMyReply(r),
                updated: this._date(r.updated),
                nav: { kind: 'ticket', ticketId: r.ticketID },
            }));

        this.tasks.filter(r => this._taskOpen(r) && this._isMine(r.assignedTech))
            .forEach(r => items.push({
                kind: 'task',
                ref: `T-${r.taskID}`,
                title: r.title || '',
                status: Number(r.status) === 2 ? 'In Progress' : 'Open',
                dl: this._deadline(r.created, r.requiredDate),
                reply: false,
                updated: this._date(r.created),
                nav: { kind: 'task', ticketId: r.ticketID, taskId: r.taskID },
            }));

        this.rfcs.filter(r => this._rfcOpen(r) && this._isMine(r.assignedTech))
            .forEach(r => items.push({
                kind: 'rfc',
                ref: `RFC-${r.rfcID}`,
                title: r.title || '',
                status: r.status || '',
                dl: this._deadline(r.created, r.targetDate),
                reply: false,
                updated: null,
                nav: { kind: 'rfc', rfcId: r.rfcID },
            }));

        // Urgency: overdue, red-window, reply-needed, amber, then by due date;
        // no-deadline items last, most recently updated first.
        const score = it =>
            it.dl.overdue ? 0 :
            it.dl.cls === 'red' ? 1 :
            it.reply ? 2 :
            it.dl.cls === 'amber' ? 3 : 4;
        items.sort((a, b) => {
            const s = score(a) - score(b);
            if (s !== 0) return s;
            if (a.dl.due && b.dl.due) return a.dl.due - b.dl.due;
            if (a.dl.due) return -1;
            if (b.dl.due) return 1;
            return (b.updated?.getTime() ?? 0) - (a.updated?.getTime() ?? 0);
        });
        return items;
    }

    _buildOversight() {
        const owned = this.projects.filter(r => this._projectActive(r)
            && this.myId != null && Number(r.ownerID) === this.myId);

        const raised = [];

        // Delegated projects: created by me, owned by someone else.
        this.projects.filter(r => this._projectActive(r)
            && this.myId != null && Number(r.createdBy) === this.myId
            && Number(r.ownerID) !== this.myId)
            .forEach(r => raised.push({
                ref: `P-${r.projectID}`,
                title: r.projectName || '',
                withWho: r.ownerName || '',
                dl: this._deadline(r.createdDate, r.targetDate),
                idle: this._idleDays(r.lastUpdateDate),
                nav: { kind: 'project', projectId: r.projectID },
            }));

        this.tickets.filter(r => this._ticketOpen(r)
            && (r.userName ?? '').trim().toLowerCase() === this.myLogin
            && !(this.myId != null && Number(r.assignedTechID) === this.myId))
            .forEach(r => raised.push({
                ref: `#${r.ticketID}`,
                title: r.subject || '',
                withWho: r.assignedTech || 'unassigned',
                dl: this._deadline(r.created, r.targetDate),
                idle: this._idleDays(r.updated),
                nav: { kind: 'ticket', ticketId: r.ticketID },
            }));

        this.tasks.filter(r => this._taskOpen(r)
            && this.myId != null && Number(r.userID) === this.myId
            && !this._isMine(r.assignedTech))
            .forEach(r => raised.push({
                ref: `T-${r.taskID}`,
                title: r.title || '',
                withWho: r.assignedTech || 'unassigned',
                dl: this._deadline(r.created, r.requiredDate),
                idle: null,
                nav: { kind: 'task', ticketId: r.ticketID, taskId: r.taskID },
            }));

        this.rfcs.filter(r => this._rfcOpen(r)
            && this._isMine(r.createdBy) && !this._isMine(r.assignedTech))
            .forEach(r => raised.push({
                ref: `RFC-${r.rfcID}`,
                title: r.title || '',
                withWho: r.assignedTech || 'unassigned',
                dl: this._deadline(r.created, r.targetDate),
                idle: null,
                nav: { kind: 'rfc', rfcId: r.rfcID },
            }));

        const rank = it => it.dl.cls === 'red' ? 0 : it.dl.cls === 'amber' ? 1 : 2;
        raised.sort((a, b) => {
            const s = rank(a) - rank(b);
            if (s !== 0) return s;
            return (b.idle ?? -1) - (a.idle ?? -1);
        });
        return { owned, raised };
    }

    // -------------------------  Render  ------------------------- //

    _renderAll() {
        const feed = this._buildFeed();
        const { owned, raised } = this._buildOversight();
        this._renderKpis(feed, owned, raised);
        this._renderFeed(feed);
        this._renderProjects(owned);
        this._renderRaised(raised);
    }

    _chip(dl) {
        if (dl.cls === 'none' || !dl.label) return '';
        return `<span class="dash-chip dash-chip--${dl.cls} mono">${Format.escapeHtml(dl.label)}</span>`;
    }

    _icon(kind) {
        const MAP = {
            ticket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 9a3 3 0 0 1 0 6v3a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-3a3 3 0 0 1 0-6V6a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1z"/></svg>',
            incident: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
            task: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
            rfc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/></svg>',
        };
        return `<span class="dash-type dash-type--${kind}">${MAP[kind] || MAP.ticket}</span>`;
    }

    _navAttrs(nav) {
        const a = [`data-kind="${nav.kind}"`];
        if (nav.ticketId != null) a.push(`data-ticket="${Number(nav.ticketId)}"`);
        if (nav.taskId != null) a.push(`data-task="${Number(nav.taskId)}"`);
        if (nav.rfcId != null) a.push(`data-rfc="${Number(nav.rfcId)}"`);
        if (nav.projectId != null) a.push(`data-project="${Number(nav.projectId)}"`);
        return a.join(' ');
    }

    _renderKpis(feed, owned, raised) {
        const el = document.getElementById('dash-kpis');
        if (!el) return;
        const overdue = feed.filter(i => i.dl.overdue).length;
        const today = feed.filter(i => i.dl.today).length;
        const replies = feed.filter(i => i.reply).length;
        const chase = raised.filter(i => i.dl.cls === 'red' || i.dl.cls === 'amber').length
            + owned.filter(p => {
                const dl = this._deadline(p.createdDate, p.targetDate);
                return dl.cls === 'red' || dl.cls === 'amber';
            }).length;
        const kpi = (n, lbl, cls) =>
            `<div class="dash-kpi"><div class="dash-kpi-n mono ${cls || ''}">${n}</div>` +
            `<div class="dash-kpi-lbl">${lbl}</div></div>`;
        el.innerHTML =
            kpi(feed.length, 'Assigned open') +
            kpi(today, 'Due today', today ? 'is-amber' : '') +
            kpi(overdue, 'Overdue', overdue ? 'is-red' : '') +
            kpi(replies, 'Replies needed', replies ? 'is-accent' : '') +
            kpi(chase, 'Need a chase', chase ? 'is-amber' : '');
    }

    _renderFeed(items) {
        const el = document.getElementById('dash-feed');
        if (!el) return;
        if (!items.length) {
            el.innerHTML = `<p class="dash-empty">${this.failed
                ? 'Couldn\u2019t load your work \u2014 try refresh.'
                : 'Nothing assigned to you is open. Enjoy it while it lasts.'}</p>`;
            return;
        }
        el.innerHTML = items.map(it =>
            `<button type="button" class="dash-row${it.dl.overdue ? ' is-overdue' : ''}" ${this._navAttrs(it.nav)}>` +
                (it.reply ? '<span class="dash-reply-dot" title="Client replied \u2014 your reply needed"></span>' : '') +
                this._icon(it.kind) +
                `<span class="dash-ref mono">${Format.escapeHtml(it.ref)}</span>` +
                `<span class="dash-title">${Format.escapeHtml(it.title)}</span>` +
                `<span class="dash-status">${Format.escapeHtml(it.status)}</span>` +
                this._chip(it.dl) +
            '</button>').join('');
    }

    _renderProjects(owned) {
        const el = document.getElementById('dash-projects');
        if (!el) return;
        if (!owned.length) {
            el.innerHTML = '<p class="dash-empty">No active projects owned by you.</p>';
            return;
        }
        el.innerHTML = owned.map(p => {
            const dl = this._deadline(p.createdDate, p.targetDate);
            const idle = this._idleDays(p.lastUpdateDate);
            const pct = Math.max(0, Math.min(100, Number(p.completionPct) || 0));
            const idleTxt = idle == null ? '' : idle === 0 ? 'active today' : `idle ${idle}d`;
            return `<button type="button" class="dash-proj" ${this._navAttrs({ kind: 'project', projectId: p.projectID })}>` +
                '<span class="dash-proj-top">' +
                    `<span class="dash-title">${Format.escapeHtml(p.projectName || '')}</span>` +
                    this._chip(dl) +
                '</span>' +
                `<span class="dash-bar"><span class="dash-bar-fill${dl.cls === 'red' || dl.cls === 'amber' ? ' is-' + dl.cls : ''}" style="width:${pct}%"></span></span>` +
                '<span class="dash-proj-meta">' +
                    `<span class="mono">${Number(p.doneTaskCount) || 0}/${Number(p.taskCount) || 0}</span> tasks` +
                    ` \u00b7 <span class="mono">${Number(p.openTicketCount) || 0}</span> open tickets` +
                    (idleTxt ? `<span class="dash-proj-idle${idle >= 5 ? ' is-amber' : ''}">${idleTxt}</span>` : '') +
                '</span>' +
            '</button>';
        }).join('');
    }

    _renderRaised(raised) {
        const el = document.getElementById('dash-raised');
        if (!el) return;
        if (!raised.length) {
            el.innerHTML = '<p class="dash-empty">Nothing you\u2019ve raised is with anyone else.</p>';
            return;
        }
        el.innerHTML = raised.map(it =>
            `<button type="button" class="dash-row dash-row--slim" ${this._navAttrs(it.nav)}>` +
                `<span class="dash-ref mono">${Format.escapeHtml(it.ref)}</span>` +
                `<span class="dash-title">${Format.escapeHtml(it.title)}</span>` +
                `<span class="dash-with">with ${Format.escapeHtml(it.withWho)}</span>` +
                (it.idle != null && it.dl.cls === 'none'
                    ? `<span class="dash-chip dash-chip--neutral mono">${it.idle === 0 ? 'updated today' : `idle ${it.idle}d`}</span>`
                    : this._chip(it.dl)) +
            '</button>').join('');
    }

    // -------------------------  Navigation  ------------------------- //

    _bindRowClicks() {
        document.getElementById('Dashboard-App')?.addEventListener('click', (e) => {
            const row = e.target.closest('[data-kind]');
            if (!row) return;
            const kind = row.dataset.kind;
            if (kind === 'ticket') {
                this.saveTicketId(row.dataset.ticket);
                sessionStorage.removeItem(STORAGE_KEYS.TD_ACTIVE_TAB);
                this.navigateToTicketDetails();
            } else if (kind === 'task') {
                if (!row.dataset.ticket) {
                    UI.toast?.('This task is not linked to a ticket', 'warning');
                    return;
                }
                // Same flow as the Tasks queue: land on the ticket with the
                // drawer open on Tasks and this task's editor expanded.
                this.saveTicketId(row.dataset.ticket);
                this.saveTaskId(row.dataset.task);
                sessionStorage.setItem(STORAGE_KEYS.TD_ACTIVE_TAB, 'tasks');
                this.navigateToTicketDetails();
            } else if (kind === 'rfc') {
                sessionStorage.setItem(STORAGE_KEYS.RFC_ID, String(row.dataset.rfc));
                Router.toRFCDetails();
            } else if (kind === 'project') {
                sessionStorage.setItem('ProjectID', String(row.dataset.project));
                Router.toProjectDetail();
            }
        });
    }
}

// -------------------------  Init  ------------------------- //

const dashboardPage = new DashboardPage();
document.addEventListener('DOMContentLoaded', () => dashboardPage.init());

if (typeof window !== 'undefined') window.dashboardPage = dashboardPage;
