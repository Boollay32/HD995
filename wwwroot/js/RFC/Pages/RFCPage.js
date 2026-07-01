// =============================  RFCPage.js  ============================= //
// The change-request (RFC) queue, on the shared QueueView engine. Server scopes
// the list by the caller, so this is purely the RFC configuration: fetch,
// columns, saved-views, and open-behaviour (→ RFCDetails).

// -------------------------  Presentation helpers  ------------------------- //

const RQ_PRIORITY_COLOR = { Urgent: 'var(--pri-urgent)', High: 'var(--pri-high)', Normal: 'var(--pri-normal)', Low: 'var(--pri-low)' };
const RQ_PRIORITY_ORDER = { Urgent: 0, High: 1, Normal: 2, Low: 3 };
const RQ_STATUS_COLOR = {
    Submitted:     ['var(--info-fg)', 'var(--info-bg)'],
    'In Progress': ['var(--warn-fg)', 'var(--warn-bg)'],
    'On Hold':     ['var(--neutral-fg)', 'var(--neutral-bg)'],
    Approved:      ['var(--ok-fg)', 'var(--ok-bg)'],
    Completed:     ['var(--ok-fg)', 'var(--ok-bg)'],
    Rejected:      ['var(--bad-fg)', 'var(--bad-bg)'],
};
const RQ_DONE = ['Completed', 'Rejected', 'Closed', 'Cancelled'];
const RQisOpen = r => !RQ_DONE.includes(r.status);
const RQstatusColor = s => RQ_STATUS_COLOR[s] || ['var(--neutral-fg)', 'var(--neutral-bg)'];
const RQdate = iso => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

// -------------------------  Page  ------------------------- //

class RFCPage extends PageBase {
    constructor() {
        super('RFC');
        this.queue = null;
    }

    async init() {
        if (!await this.checkAuth()) return;
        if (typeof SetActivePage === 'function') SetActivePage('RFCMenu');

        try {
            await this.waitForElement('queue-mount');
        } catch {
            this.handleError('Page elements failed to load.');
            return;
        }

        this.queue = new QueueView('#queue-mount', this._config());
        await this.queue.load();
    }

    async _fetch() {
        const data = await API.post('RFC/GetRFCs', API.authPayload({ filters: {} }));
        return Array.isArray(data) ? data : [];
    }

    _open(row) {
        sessionStorage.setItem(STORAGE_KEYS.RFC_ID, row.rfcID);
        this.navigateToRFCDetails();
    }

    _config() {
        // "My open": RFC rows have no numeric assignee/originator ID, so
        // match by normalised display name against both the raw login and
        // the resolved display name (UserName here is a login credential).
        const norm = s => (s ?? '').trim().toLowerCase();
        const myNameKeys = new Set([norm(this.username), norm(this.displayName)].filter(Boolean));
        const isMyRFC = r => myNameKeys.has(norm(r.assignedTech)) || myNameKeys.has(norm(r.createdBy));
        return {
            title: 'RFC',
            fetch: () => this._fetch(),
            rowKey: r => r.rfcID,
            search: ['title', 'createdBy', 'rfcID'],

            action: { label: '+ New RFC', onClick: () => Router.toCreateRFC() },

            views: [
                { id: 'mine',  label: 'My open',     filter: r => isMyRFC(r) && RQisOpen(r) },
                { id: 'all',   label: 'All open',    filter: r => RQisOpen(r) },
                { id: 'unass', label: 'Unassigned',  filter: r => !r.assignedTech && RQisOpen(r) },
            ],

            filters: [
                { id: 'prio', label: 'Priority', field: 'priority' },
                { id: 'stat', label: 'Status',   field: 'status' },
                { id: 'asg',  label: 'Assignee', field: 'assignedTech' },
            ],

            columns: [
                {
                    key: 'title', label: 'Change request', sortable: true,
                    sortValue: r => (r.title || '').toLowerCase(),
                    render: r => `<div class="qv-subj"><div><div class="s1">${Format.escapeHtml(r.title)}</div><div class="s2"><span class="qv-ref">#${r.rfcID}</span> · ${Format.escapeHtml(r.createdBy)}</div></div></div>`
                },
                {
                    key: 'priority', label: 'Priority', sortable: true,
                    sortValue: r => RQ_PRIORITY_ORDER[r.priority] ?? 9,
                    render: r => `<span class="qv-prio"><span class="qv-led" style="background:${RQ_PRIORITY_COLOR[r.priority] || 'var(--pri-normal)'}"></span>${Format.escapeHtml(r.priority)}</span>`
                },
                {
                    key: 'status', label: 'Status',
                    render: r => { const c = RQstatusColor(r.status); return `<span class="qv-status" style="color:${c[0]};background:${c[1]}">${Format.escapeHtml(r.status)}</span>`; }
                },
                {
                    key: 'assignedTech', label: 'Assignee',
                    render: r => r.assignedTech
                        ? `<span class="qv-assignee"><span class="qv-av" style="background:${UI.avatarColor(r.assignedTech)}">${Format.initials(r.assignedTech)}</span>${Format.escapeHtml(r.assignedTech)}</span>`
                        : '<span class="qv-unassigned">Unassigned</span>'
                },
                {
                    key: 'targetDate', label: 'Target', sortable: true,
                    sortValue: r => new Date(r.targetDate).getTime() || Infinity,
                    render: r => `<span class="qv-updated">${RQdate(r.targetDate)}</span>`
                },
            ],

            defaultSort: { key: 'targetDate', dir: 1 },

            previewHeader: r => `<div class="qv-pv-tid">#${r.rfcID}</div><div class="qv-pv-title">${Format.escapeHtml(r.title)}</div>
                <div class="qv-pv-meta"><span class="qv-pv-chip"><span class="qv-pv-chip-label">Priority</span><span class="qv-prio"><span class="qv-led" style="background:${RQ_PRIORITY_COLOR[r.priority] || 'var(--pri-normal)'}"></span>${Format.escapeHtml(r.priority)}</span></span></div>`,
            preview: r => {
                const c = RQstatusColor(r.status);
                return `<h3 class="qv-pv-h">Raised by</h3>
                    <div class="qv-pv-dl" style="margin-bottom:6px">
                      <span class="qv-pv-dt">Raised by</span><span class="qv-pv-dd">${Format.escapeHtml(r.createdBy)}</span>
                    </div>
                    <h3 class="qv-pv-h">At a glance</h3>
                    <div class="qv-pv-dl">
                      <span class="qv-pv-dt">Status</span><span class="qv-pv-dd"><span class="qv-status" style="color:${c[0]};background:${c[1]}">${Format.escapeHtml(r.status)}</span></span>
                      <span class="qv-pv-dt">Priority</span><span class="qv-pv-dd"><span class="qv-prio"><span class="qv-led" style="background:${RQ_PRIORITY_COLOR[r.priority] || 'var(--pri-normal)'}"></span>${Format.escapeHtml(r.priority)}</span></span>
                      <span class="qv-pv-dt">Assignee</span><span class="qv-pv-dd">${r.assignedTech ? Format.escapeHtml(r.assignedTech) : '<span class="qv-unassigned">Unassigned</span>'}</span>
                      <span class="qv-pv-dt">Target</span><span class="qv-pv-dd">${RQdate(r.targetDate)}</span>
                    </div>`;
            },
            onOpen: r => this._open(r),
        };
    }
}

// -------------------------  Init  ------------------------- //

const rfcPage = new RFCPage();
document.addEventListener('DOMContentLoaded', () => rfcPage.init());
if (typeof window !== 'undefined') window.rfcPage = rfcPage;
