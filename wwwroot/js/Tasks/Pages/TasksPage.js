// =============================  TasksPage.js  ============================= //
// The "all tasks" queue, on the shared QueueView engine. There is no separate
// task detail screen: opening a task lands on its parent ticket, on the Tasks
// tab, so tasks always live in the context of their ticket.

// -------------------------  Presentation helpers  ------------------------- //

// Status legend matches the editor dropdown: 1 New, 2 In Progress, 3 Complete,
// 4 Withdrawn, 5 Draft. "Open" work is New or In Progress.
const KQ_STATUS = { 1: 'New', 2: 'In Progress', 3: 'Complete', 4: 'Withdrawn', 5: 'Draft' };
const KQ_STATUS_COLOR = {
    'New':         ['var(--info-fg)', 'var(--info-bg)'],
    'In Progress': ['var(--warn-fg)', 'var(--warn-bg)'],
    'Complete':    ['var(--ok-fg)', 'var(--ok-bg)'],
    'Withdrawn':   ['var(--bad-fg)', 'var(--bad-bg)'],
    'Draft':       ['var(--neutral-fg)', 'var(--neutral-bg)'],
};
const KQ_OPEN = new Set([1, 2]);
const KQlabel = s => KQ_STATUS[s] ?? 'Other';
const KQstatusColor = label => KQ_STATUS_COLOR[label] || ['var(--neutral-fg)', 'var(--neutral-bg)'];
const KQisOpen = r => KQ_OPEN.has(r.status);
const KQdate = iso => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

// -------------------------  Page  ------------------------- //

class TaskPage extends PageBase {
    constructor() {
        super('Task');
        this.queue = null;
        this.myName = null;   // resolved display name for the "My open" filter
    }

    async init() {
        if (!await this.checkAuth()) return;
        if (typeof SetActivePage === 'function') SetActivePage('TaskMenu');

        try {
            await this.waitForElement('queue-mount');
        } catch {
            this.handleError('Page elements failed to load.');
            return;
        }

        // The task list shows the assignee as a display name; resolve ours so the
        // "My open" view can match. Must run before _config() builds the filters.
        await this._resolveMyName();
        this.queue = new QueueView('#queue-mount', this._config());
        // "My Tasks" vs "View Tasks": the nav sets MY_TICKETS to pick the default view.
        this.queue.view = sessionStorage.getItem(STORAGE_KEYS.MY_TICKETS) === '1' ? 'mine' : 'all';
        await this.queue.load();
    }

    // The list shows the assignee as a display name, but our stored identity is the
    // login + UserID. Resolve our name from the assignable-tech list so "My open" can
    // compare names. On failure, leaves myName null and the login compare still applies.
    async _resolveMyName() {
        try {
            const data = await API.post('Misc/GetDropDownList',
                API.authPayload({ filter: '0', group: 'Ticket' }));
            const techs = (data && data.assignedTechName) || [];
            const myId = String(sessionStorage.getItem(STORAGE_KEYS.USER_ID) ?? '');
            const mineRow = techs.find(t => String(t.id) === myId);
            this.myName = mineRow ? mineRow.name : null;
        } catch (err) {
            console.error('Tasks._resolveMyName:', err);
        }
    }

    async _fetch() {
        const data = await API.post('Task/GetTasks', API.authPayload({ filters: {} }));
        const rows = Array.isArray(data) ? data : [];
        rows.forEach(r => { r._status = KQlabel(r.status); });   // friendly label for column + filter
        return rows;
    }

    // No task detail screen — open the task inside its parent ticket's Tasks tab.
    _open(task) {
        if (task.ticketID) {
            this.saveTicketId(task.ticketID);
            this.saveTaskId(task.taskID);
            sessionStorage.setItem(STORAGE_KEYS.TD_ACTIVE_TAB, 'tasks');
            this.navigateToTicketDetails();
        } else {
            // Orphan task with no parent ticket: there is no standalone editor,
            // so there is nothing to open — tell the user instead of 404ing.
            UI.toast?.('This task is not linked to a ticket', 'warning');
        }
    }

    _config() {
        // "My open" matches the assignee (a display name) against both our login and
        // our resolved name, so it works whichever identifier the proc returns.
        const norm = s => (s ?? '').trim().toLowerCase();
        const mineKeys = new Set([norm(this.username), norm(this.myName)].filter(Boolean));
        const isMine = r => mineKeys.has(norm(r.assignedTech));
        return {
            title: 'Tasks',
            fetch: () => this._fetch(),
            rowKey: r => r.taskID,
            search: ['title', 'assignedTech', 'taskID', 'ticketID'],

            views: [
                { id: 'mine',  label: 'My open',     filter: r => isMine(r) && KQisOpen(r) },
                { id: 'all',   label: 'All open',    filter: r => KQisOpen(r) },
                { id: 'wdn',   label: 'Withdrawn',   filter: r => r.status === 4 },
                { id: 'cmp',   label: 'Complete',    filter: r => r.status === 3 },
            ],

            filters: [
                { id: 'stat', label: 'Status',   field: '_status', overridesView: true },
                { id: 'asg',  label: 'Assignee', field: 'assignedTech' },
            ],

            columns: [
                {
                    key: 'title', label: 'Task', sortable: true,
                    sortValue: r => (r.title || '').toLowerCase(),
                    render: r => `<div class="qv-subj"><div><div class="s1">${Format.escapeHtml(r.title)}</div><div class="s2"><span class="qv-ref">#${r.taskID}</span>${r.important ? '<span title="Important" style="color:var(--accent);margin-left:4px">\u2605</span>' : ''}</div></div></div>`
                },
                {
                    key: 'ticketID', label: 'Ticket', sortable: true,
                    sortValue: r => r.ticketID ?? 0,
                    render: r => r.ticketID ? `<span class="qv-badge qv-ref">#${r.ticketID}</span>` : '<span class="qv-unassigned">—</span>'
                },
                {
                    key: 'assignedTech', label: 'Assignee',
                    render: r => r.assignedTech
                        ? `<span class="qv-assignee"><span class="qv-av" style="background:${UI.avatarColor(r.assignedTech)}">${Format.initials(r.assignedTech)}</span>${Format.escapeHtml(r.assignedTech)}</span>`
                        : '<span class="qv-unassigned">Unassigned</span>'
                },
                {
                    key: '_status', label: 'Status',
                    render: r => { const c = KQstatusColor(r._status); return `<span class="qv-status" style="color:${c[0]};background:${c[1]}">${Format.escapeHtml(r._status)}</span>`; }
                },
                {
                    key: 'requiredDate', label: 'Required by', sortable: true,
                    sortValue: r => new Date(r.requiredDate).getTime() || Infinity,
                    render: r => `<span class="qv-updated">${KQdate(r.requiredDate)}</span>`
                },
            ],

            defaultSort: { key: 'requiredDate', dir: 1 },

            previewHeader: r => `<div class="qv-pv-tid">#${r.taskID}${r.ticketID ? ` \u00b7 Ticket #${r.ticketID}` : ''}</div><div class="qv-pv-title">${Format.escapeHtml(r.title)}</div>
                <div class="qv-pv-meta"><span class="qv-pv-chip"><span class="qv-pv-chip-label">Status</span><span class="qv-status" style="color:${KQstatusColor(r._status)[0]};background:${KQstatusColor(r._status)[1]}">${Format.escapeHtml(r._status)}</span></span></div>`,
            preview: r => `<h3 class="qv-pv-h">Detail</h3>
                <div style="font-size:0.78125rem;line-height:1.6;margin-bottom:10px">${Format.escapeHtml(r.description) || '\u2014'}</div>
                <h3 class="qv-pv-h">At a glance</h3>
                <div class="qv-pv-dl">
                  <span class="qv-pv-dt">Status</span><span class="qv-pv-dd"><span class="qv-status" style="color:${KQstatusColor(r._status)[0]};background:${KQstatusColor(r._status)[1]}">${Format.escapeHtml(r._status)}</span></span>
                  <span class="qv-pv-dt">Assignee</span><span class="qv-pv-dd">${r.assignedTech ? Format.escapeHtml(r.assignedTech) : '<span class="qv-unassigned">Unassigned</span>'}</span>
                  <span class="qv-pv-dt">Required by</span><span class="qv-pv-dd">${KQdate(r.requiredDate)}</span>
                  <span class="qv-pv-dt">Parent</span><span class="qv-pv-dd">${r.ticketID ? `Ticket #${r.ticketID}` : '\u2014'}</span>
                </div>`,
            onOpen: r => this._open(r),
        };
    }
}

// -------------------------  Init  ------------------------- //

const taskPage = new TaskPage();
document.addEventListener('DOMContentLoaded', () => taskPage.init());
if (typeof window !== 'undefined') window.taskPage = taskPage;
