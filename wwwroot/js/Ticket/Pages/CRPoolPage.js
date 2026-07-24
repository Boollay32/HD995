// =============================  CRPoolPage.js  ============================= //
// The unassigned-CR pool: change-request tickets (types 4/10/11) that belong
// to no project yet. All list behaviour lives in QueueView; this file is the
// pool configuration: how to fetch, columns/views, the "+ New CR" create
// context, and the admin-only bulk "Assign to project" action.
// Rows here are structurally guaranteed by usp_Helpdesk_GetUnassignedCRs to
// have ProjectID NULL and no target date until they are assigned.

// -------------------------  Presentation helpers  ------------------------- //

const CRQ_PRIORITY_COLOR = { Urgent: 'var(--pri-urgent)', High: 'var(--pri-high)', Normal: 'var(--pri-normal)', Low: 'var(--pri-low)' };
const CRQ_PRIORITY_ORDER = { Urgent: 0, High: 1, Normal: 2, Low: 3 };
const CRQ_STATUS_COLOR = {
    Open:      ['var(--info-fg)', 'var(--info-bg)'],
    Pending:   ['var(--warn-fg)', 'var(--warn-bg)'],
    'On Hold': ['var(--neutral-fg)', 'var(--neutral-bg)'],
    Closed:    ['var(--accent-2)', 'var(--accent-2-bg)'],
    Solved:    ['var(--ok-fg)', 'var(--ok-bg)'],
};
const CRQisOpen = r => !['Closed', 'Solved'].includes(r.status);
const CRQdate = iso => { if (!iso) return '\u2014'; const d = new Date(iso); return isNaN(d) ? '\u2014' : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }); };
const CRQago = iso => {
    if (!iso) return '\u2014';
    const m = Math.round((Date.now() - new Date(iso)) / 60000);
    if (isNaN(m)) return '\u2014';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
};

// -------------------------  Page  ------------------------- //

class CRPoolPage extends PageBase {
    constructor() {
        super('Ticket');
        this.queue = null;
        this._projectByLabel = {};   // bulk-assign option label -> projectID
    }

    async init() {
        if (!await this.checkAuth()) return;
        if (typeof SetActivePage === 'function') SetActivePage('ProjectsMenu');
        if (typeof UserPermissions === 'function') UserPermissions();

        try {
            await this.waitForElement('queue-mount');
        } catch {
            this.handleError('Page elements failed to load.');
            return;
        }

        // Assigning a CR to a project is Govtech-Admin only (level 2), same
        // gate as SaveProject; the bulk bar only exists for admins.
        let isAdmin = false;
        try { isAdmin = (await AdminContext.resolve()) === 2; }
        catch (err) { console.error('CRPoolPage admin check:', err); }
        if (isAdmin) await this._loadProjects();

        this.queue = new QueueView('#queue-mount', this._config(isAdmin));
        await this.queue.load();
    }

    // ---- Assignable projects: active/new only; complete or withdrawn
    //      projects are not valid assignment targets ----
    async _loadProjects() {
        try {
            const data = await API.post('Project/GetProjects',
                API.authPayload({ statusId: null }));
            const projects = (Array.isArray(data) ? data : []).filter(p => {
                const s = String(p.status ?? '').toLowerCase();
                return s !== 'complete' && s !== 'withdrawn';
            });
            // Bulk options are plain labels; disambiguate duplicate names
            // with the project id so the label -> id map stays 1:1.
            const nameCount = {};
            projects.forEach(p => { const n = p.projectName ?? ''; nameCount[n] = (nameCount[n] || 0) + 1; });
            this._projectByLabel = {};
            projects.forEach(p => {
                const n = p.projectName ?? '';
                const label = nameCount[n] > 1 ? `${n} (#${p.projectID})` : n;
                this._projectByLabel[label] = p.projectID;
            });
        } catch (err) {
            console.error('CRPoolPage._loadProjects:', err);
            this._projectByLabel = {};
        }
    }

    // ---- Data ----
    async _fetch() {
        const data = await API.post('Ticket/GetUnassignedCRs', API.authPayload({
            myTicket: 0,
            filters: {}
        }));
        return Array.isArray(data) ? data : [];
    }

    // ---- Assign the selected rows to one project ----
    async _assign(label, rows) {
        const projectId = this._projectByLabel[label];
        if (!Number.isFinite(projectId)) return;
        for (const r of rows) {
            try {
                await API.post('Ticket/SetTicketProject',
                    API.authPayload({ ticketID: r.ticketID, projectID: projectId }));
            } catch (err) {
                console.error(`CRPoolPage assign #${r.ticketID}:`, err);
            }
        }
        UI.flash?.(`Assigned ${rows.length} CR${rows.length === 1 ? '' : 's'} to ${label}`, 'success');
    }

    _open(row) {
        this.saveTicketId(row.ticketID);
        sessionStorage.removeItem(STORAGE_KEYS.TD_ACTIVE_TAB);
        this.navigateToTicketDetails();   // Router records /CRPool as the back target
    }

    // ---- Config consumed by QueueView ----
    _config(isAdmin) {
        const projectLabels = Object.keys(this._projectByLabel);
        return {
            title: 'CR Pool',
            action: { label: '+ New CR', onClick: () => { sessionStorage.setItem('NewTicketPoolCR', '1'); Router.toCreateTicket(); } },
            fetch: () => this._fetch(),
            rowKey: r => r.ticketID,
            search: ['subject', 'userName', 'ticketID'],

            views: [
                { id: 'open', label: 'Open', filter: r => CRQisOpen(r) },
                { id: 'all',  label: 'All',  filter: () => true },
            ],

            filters: [
                { id: 'type', label: 'Type',     field: 'requestType' },
                { id: 'prio', label: 'Priority', field: 'priority' },
                { id: 'stat', label: 'Status',   field: 'status' },
            ],

            ...(isAdmin && projectLabels.length ? {
                bulk: [{
                    id: 'assign',
                    label: 'Assign to project',
                    options: projectLabels,
                    apply: (value, rows) => this._assign(value, rows),
                }]
            } : {}),

            columns: [
                {
                    key: 'subject', label: 'Ticket', sortable: true,
                    sortValue: r => (r.subject || '').toLowerCase(),
                    render: r => `<div class="qv-subj"><div><div class="s1">${Format.escapeHtml(r.subject)}</div><div class="s2"><span class="qv-ref">#${r.ticketID}</span> \u00b7 ${Format.escapeHtml(r.userName)}</div></div></div>`
                },
                {
                    key: 'requestType', label: 'Type',
                    render: r => `<span class="qv-badge">${Format.escapeHtml(r.requestType)}</span>`
                },
                {
                    key: 'priority', label: 'Priority', sortable: true,
                    sortValue: r => CRQ_PRIORITY_ORDER[r.priority] ?? 9,
                    render: r => `<span class="qv-prio"><span class="qv-led" style="background:${CRQ_PRIORITY_COLOR[r.priority] || 'var(--pri-normal)'}"></span>${Format.escapeHtml(r.priority)}</span>`
                },
                {
                    key: 'status', label: 'Status',
                    render: r => {
                        const c = CRQ_STATUS_COLOR[r.status] || ['var(--neutral-fg)', 'var(--neutral-bg)'];
                        return `<span class="qv-status" style="color:${c[0]};background:${c[1]}">${Format.escapeHtml(r.status)}</span>`;
                    }
                },
                {
                    key: 'created', label: 'Raised', sortable: true,
                    sortValue: r => new Date(r.created).getTime() || 0,
                    render: r => `<span class="qv-updated">${CRQdate(r.created)}</span>`
                },
            ],

            defaultSort: { key: 'created', dir: 1 },

            previewHeader: r => `<div class="qv-pv-tid">#${r.ticketID}</div><div class="qv-pv-title">${Format.escapeHtml(r.subject)}</div>
                <div class="qv-pv-meta">
                  <span class="qv-pv-chip"><span class="qv-pv-chip-label">Type</span><span class="qv-badge">${Format.escapeHtml(r.requestType)}</span></span>
                  <span class="qv-pv-chip"><span class="qv-pv-chip-label">Priority</span><span class="qv-prio"><span class="qv-led" style="background:${CRQ_PRIORITY_COLOR[r.priority] || 'var(--pri-normal)'}"></span>${Format.escapeHtml(r.priority)}</span></span>
                </div>`,
            preview: r => {
                const sc = CRQ_STATUS_COLOR[r.status] || ['var(--neutral-fg)', 'var(--neutral-bg)'];
                const note = (r.notes || '').trim();
                const snippet = note.length > 220 ? note.slice(0, 220) + '\u2026' : note;
                return `<h3 class="qv-pv-h">Raised by</h3>
                <div class="qv-assignee" style="margin-bottom:14px"><span class="qv-av" style="background:${UI.avatarColor(r.userName)};width:28px;height:28px;font-size:0.625rem">${Format.initials(r.userName)}</span><div><div style="font-weight:600;font-size:0.8125rem">${Format.escapeHtml(r.userName)}</div><div style="font-size:0.71875rem;color:var(--muted, #6A655C)">${Format.escapeHtml(r.authority)}</div></div></div>
                <h3 class="qv-pv-h">At a glance</h3>
                <div class="qv-pv-dl">
                  <span class="qv-pv-dt">Status</span><span class="qv-pv-dd"><span class="qv-status" style="color:${sc[0]};background:${sc[1]}">${Format.escapeHtml(r.status)}</span></span>
                  <span class="qv-pv-dt">Type</span><span class="qv-pv-dd">${Format.escapeHtml(r.requestType)}</span>
                  <span class="qv-pv-dt">Raised</span><span class="qv-pv-dd">${CRQdate(r.created)}</span>
                  <span class="qv-pv-dt">Last activity</span><span class="qv-pv-dd">${CRQago(r.updated)}</span>
                  <span class="qv-pv-dt">Project</span><span class="qv-pv-dd">Unassigned (in pool)</span>
                </div>
                ${snippet ? `<h3 class="qv-pv-h">Latest note</h3><div style="font-size:0.78125rem;line-height:1.6">${Format.escapeHtml(snippet)}</div>` : ''}`;
            },
            onOpen: r => this._open(r),
        };
    }
}

// -------------------------  Init  ------------------------- //

const crPoolPage = new CRPoolPage();
document.addEventListener('DOMContentLoaded', () => crPoolPage.init());
if (typeof window !== 'undefined') window.crPoolPage = crPoolPage;
