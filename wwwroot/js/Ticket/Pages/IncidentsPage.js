// =============================  IncidentsPage.js  ============================= //
// The ticket queue. All list behaviour lives in QueueView; this file is just
// the Tickets configuration: how to fetch, which columns/views, and what
// happens when a row is opened.

// -------------------------  Presentation helpers  ------------------------- //

const TQ_PRIORITY_COLOR = { Urgent: 'var(--pri-urgent)', High: 'var(--pri-high)', Normal: 'var(--pri-normal)', Low: 'var(--pri-low)' };
const TQ_PRIORITY_ORDER = { Urgent: 0, High: 1, Normal: 2, Low: 3 };
const TQ_STATUS_COLOR = {
    Open:      ['var(--info-fg)', 'var(--info-bg)'],
    Pending:   ['var(--warn-fg)', 'var(--warn-bg)'],
    'On Hold': ['var(--neutral-fg)', 'var(--neutral-bg)'],
    Closed:    ['var(--ok-fg)', 'var(--ok-bg)'],
    Solved:    ['var(--ok-fg)', 'var(--ok-bg)'],
};
const TQisOpen = r => !['Closed', 'Solved'].includes(r.status);
// The assigned tech has a client reply to answer: notify '0' (client
// replied) and the ticket is assigned to the current user. myId is set
// per-render in _config (sessionStorage UserID).
let TQ_MY_ID = null;
const TQneedsMyReply = r => r.notify === '0' && TQ_MY_ID != null && Number(r.assignedTechID) === TQ_MY_ID;
const TQdate = iso => { if (!iso) return '—'; const d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }); };
const TQago = iso => {
    if (!iso) return '—';
    const m = Math.round((Date.now() - new Date(iso)) / 60000);
    if (isNaN(m)) return '—';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
};

// -------------------------  Page  ------------------------- //

class IncidentPage extends PageBase {
    constructor() {
        super('Ticket');
        this.queue = null;
    }

    async init() {
        if (!await this.checkAuth()) return;
        if (typeof SetActivePage === 'function') SetActivePage('IncidentsMenu');
        if (typeof UserPermissions === 'function') UserPermissions();

        try {
            await this.waitForElement('queue-mount');
        } catch {
            this.handleError('Page elements failed to load.');
            return;
        }

        this.queue = new QueueView('#queue-mount', this._config());
        await this.queue.load();
    }

    // ---- Data: fetch the full permitted set; saved-views slice it client-side ----
    async _fetch() {
        const data = await API.post('Ticket/GetIncidents', API.authPayload({
            myTicket: 0,          // 0 = all the user may see; "My open" is a client-side view
            filters: {}
        }));
        return Array.isArray(data) ? data : [];
    }

    // ---- Open a ticket: reuse the existing session + navigation flow ----
    _open(row) {
        this.saveTicketId(row.ticketID);
        // HD35 1a: a normal ticket open must start on Details. Only the Tasks
        // queue sets TD_ACTIVE_TAB; clear any leftover here so a stale 'tasks'
        // request from an earlier task-queue open can't open this ticket on Tasks.
        sessionStorage.removeItem(STORAGE_KEYS.TD_ACTIVE_TAB);
        this.navigateToTicketDetails();
    }

    // ---- Config consumed by QueueView ----
    _config() {
        const myId = Number(sessionStorage.getItem(STORAGE_KEYS.USER_ID));
        TQ_MY_ID = Number.isNaN(myId) ? null : myId;
        return {
            title: 'Incidents',
            action: { label: '+ New Incident', onClick: () => { sessionStorage.setItem('NewTicketIncident', '1'); Router.toCreateTicket(); } },
            fetch: () => this._fetch(),
            rowKey: r => r.ticketID,
            search: ['subject', 'userName', 'ticketID'],

            views: [
                { id: 'all',   label: 'All open',     filter: r => TQisOpen(r) },
                { id: 'reply', label: 'Needs reply', filter: r => r.notify === '0' && TQisOpen(r) },
            ],

            filters: [
                { id: 'type', label: 'Type',     field: 'requestType' },
                { id: 'prio', label: 'Priority', field: 'priority' },
                { id: 'stat', label: 'Status',   field: 'status' },
            ],

            columns: [
                {
                    key: 'subject', label: 'Ticket', sortable: true,
                    sortValue: r => (r.subject || '').toLowerCase(),
                    render: r => `<div class="qv-subj">${TQneedsMyReply(r) ? '<span class="qv-unread qv-mine" title="Client replied \u2013 your reply needed"></span>' : (r.notify === '0' ? '<span class="qv-unread" title="Awaiting reply"></span>' : '')}<div><div class="s1">${Format.escapeHtml(r.subject)}</div><div class="s2"><span class="qv-ref">#${r.ticketID}</span> · ${Format.escapeHtml(r.userName)}</div></div></div>`
                },
                {
                    key: 'requestType', label: 'Type',
                    render: r => `<span class="qv-badge">${Format.escapeHtml(r.requestType)}</span>`
                },
                {
                    key: 'priority', label: 'Priority', sortable: true,
                    sortValue: r => TQ_PRIORITY_ORDER[r.priority] ?? 9,
                    render: r => `<span class="qv-prio"><span class="qv-led" style="background:${TQ_PRIORITY_COLOR[r.priority] || 'var(--pri-normal)'}"></span>${Format.escapeHtml(r.priority)}</span>`
                },
                {
                    key: 'status', label: 'Status',
                    render: r => {
                        const c = TQ_STATUS_COLOR[r.status] || ['var(--neutral-fg)', 'var(--neutral-bg)'];
                        return `<span class="qv-status" style="color:${c[0]};background:${c[1]}">${Format.escapeHtml(r.status)}</span>`;
                    }
                },
                {
                    key: 'updated', label: 'Updated', sortable: true,
                    sortValue: r => new Date(r.updated).getTime() || 0,
                    render: r => `<span class="qv-updated">${TQago(r.updated)}</span>`
                },
            ],

            defaultSort: { key: 'notify', dir: 1 },

            previewHeader: r => `<div class="qv-pv-tid">#${r.ticketID}</div><div class="qv-pv-title">${Format.escapeHtml(r.subject)}</div>
                <div class="qv-pv-meta">
                  <span class="qv-pv-chip"><span class="qv-pv-chip-label">Type</span><span class="qv-badge">${Format.escapeHtml(r.requestType)}</span></span>
                  <span class="qv-pv-chip"><span class="qv-pv-chip-label">Priority</span><span class="qv-prio"><span class="qv-led" style="background:${TQ_PRIORITY_COLOR[r.priority] || 'var(--pri-normal)'}"></span>${Format.escapeHtml(r.priority)}</span></span>
                </div>`,
            preview: r => {
                const sc = TQ_STATUS_COLOR[r.status] || ['var(--neutral-fg)', 'var(--neutral-bg)'];
                const note = (r.notes || '').trim();
                const snippet = note.length > 220 ? note.slice(0, 220) + '\u2026' : note;
                return `<h3 class="qv-pv-h">Requester</h3>
                <div class="qv-assignee" style="margin-bottom:14px"><span class="qv-av" style="background:${UI.avatarColor(r.userName)};width:28px;height:28px;font-size:0.625rem">${Format.initials(r.userName)}</span><div><div style="font-weight:600;font-size:0.8125rem">${Format.escapeHtml(r.userName)}</div><div style="font-size:0.71875rem;color:var(--muted, #6A655C)">${Format.escapeHtml(r.authority)}</div></div></div>
                <h3 class="qv-pv-h">At a glance</h3>
                <div class="qv-pv-dl">
                  <span class="qv-pv-dt">Status</span><span class="qv-pv-dd"><span class="qv-status" style="color:${sc[0]};background:${sc[1]}">${Format.escapeHtml(r.status)}</span></span>
                  <span class="qv-pv-dt">Priority</span><span class="qv-pv-dd"><span class="qv-prio"><span class="qv-led" style="background:${TQ_PRIORITY_COLOR[r.priority] || 'var(--pri-normal)'}"></span>${Format.escapeHtml(r.priority)}</span></span>
                  <span class="qv-pv-dt">Type</span><span class="qv-pv-dd">${Format.escapeHtml(r.requestType)}</span>
                  <span class="qv-pv-dt">Opened</span><span class="qv-pv-dd">${TQdate(r.created)}</span>
                  <span class="qv-pv-dt">Last activity</span><span class="qv-pv-dd">${TQago(r.updated)}</span>
                  ${r.notify === '0' ? '<span class="qv-pv-dt">Reply</span><span class="qv-pv-dd" style="color:var(--accent-strong);font-weight:600">\u25cf Reply needed</span>' : r.notify === '1' ? '<span class="qv-pv-dt">Reply</span><span class="qv-pv-dd" style="color:var(--muted);font-weight:600">\u25cf Awaiting client</span>' : ''}
                </div>
                ${snippet ? `<h3 class="qv-pv-h">Latest note</h3><div style="font-size:0.78125rem;line-height:1.6">${Format.escapeHtml(snippet)}</div>` : ''}`;
            },
            onOpen: r => this._open(r),
        };
    }
}

// -------------------------  Init  ------------------------- //

const incidentPage = new IncidentPage();
document.addEventListener('DOMContentLoaded', () => incidentPage.init());
if (typeof window !== 'undefined') window.incidentPage = incidentPage;
