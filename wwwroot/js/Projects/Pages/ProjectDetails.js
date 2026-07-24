// =============================  ProjectDetails.js  ============================= //
// One project: its header (type/status/owner/dates + roll-up) and the tickets it
// contains. Tickets are only visible here, inside the project. Clicking a ticket
// opens it in the normal ticket detail page.

class ProjectDetails extends PageBase {
    constructor() {
        super();
        this.projectId = sessionStorage.getItem('ProjectID');
        this.project = null;
    }

    async init() {
        if (!await this.checkAuth()) return;
        try {
            SetActivePage('ProjectsMenu');
            if (typeof UserPermissions === 'function') UserPermissions();
            this._wireBack();
            this._wireNewTicket();
            await this._setupEdit();
            await this._load();
        } catch (error) {
            if (error.message !== 'Unauthorized') {
                this.handleError('Error initializing project details');
            }
        }
    }

    _wireBack() {
        document.getElementById('pjd-back')
            ?.addEventListener('click', () => Router.toProjectsPage());
    }

    _wireNewTicket() {
        // Add a ticket to this project: stamp the id and open the create page,
        // which locks the project field and stores the FK (Stage 5 flow).
        document.getElementById('pjd-new-ticket')
            ?.addEventListener('click', () => {
                sessionStorage.setItem('NewTicketProjectID', String(this.projectId));
                Router.toCreateTicket();
            });
    }

    async _setupEdit() {
        // Only Govtech Admins (level 2) can edit a project - the same gate
        // covers moving CRs between this project and the pool.
        try {
            const level = await AdminContext.resolve();
            this._isAdmin = (level === 2);
            if (level === 2) {
                this._wirePool();
                const btn = document.getElementById('pjd-edit');
                if (btn) {
                    btn.style.display = '';
                    btn.addEventListener('click', () => {
                        sessionStorage.setItem('EditProjectID', String(this.projectId));
                        Router.toProjectForm();
                    });
                }
            }
        } catch (err) { console.error('ProjectDetails._setupEdit:', err); }
    }

    async _load() {
        const id = parseInt(this.projectId, 10);
        if (!Number.isFinite(id)) {
            this._renderError('No project selected.');
            return;
        }
        try {
            const data = await API.post('Project/GetProjectDetail',
                API.authPayload({ projectId: id }));
            if (!data || !data.projectID) {
                this._renderError('Project not found.');
                return;
            }
            this.project = data;
            this._allTickets = Array.isArray(data.tickets) ? data.tickets : [];
            this._renderHeader(data);
            this._setupStatusFilter();
            this._renderTickets(this._applyStatusFilter(this._allTickets));
        } catch (err) {
            console.error('ProjectDetails._load:', err);
            this._renderError("Couldn't load this project. Please try again.");
        }
    }

    _renderHeader(p) {
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

        set('pjd-name', p.projectName ?? '');
        document.title = `${p.projectName ?? 'Project'} - Govtech HelpDesk`;

        set('pjd-type', p.projectType || '—');
        const statusEl = document.getElementById('pjd-status');
        if (statusEl) {
            statusEl.textContent = p.status ?? '';
            statusEl.className = `pj-status pj-status--${this._statusClass(p.status)}`;
        }

        set('pjd-owner', p.ownerName || '—');
        set('pjd-created-by', p.createdByName || '—');
        set('pjd-created', p.createdDate ? this._fmtDate(p.createdDate) : '—');
        set('pjd-target', p.targetDate ? this._fmtDate(p.targetDate) : 'No target date');
        set('pjd-completion', p.completionDate ? this._fmtDate(p.completionDate) : '—');
        set('pjd-desc', p.description || 'No description.');

        // 6a: open vs complete tickets, derived from the loaded ticket list
        // so the breakdown matches the row states shown below (_isClosed =
        // the page's "closed" notion: Complete/Resolved/Closed, statusID 3/5).
        const tks = Array.isArray(p.tickets) ? p.tickets : [];
        const completeTickets = tks.filter(t => this._isClosed(t.statusID, t.status)).length;
        const openTickets = tks.length - completeTickets;
        set('pjd-ticket-count', `${openTickets} open \u00b7 ${completeTickets} complete`);
    }

    _renderTickets(tickets) {
        const tbody = document.getElementById('pjd-ticket-rows');
        const empty = document.getElementById('pjd-tickets-empty');
        if (!tbody) return;

        if (!tickets.length) {
            tbody.innerHTML = '';
            if (empty) {
                // Distinguish a project with no tickets from a filter that
                // matched none, so the message isn't misleading.
                empty.textContent = (this._allTickets && this._allTickets.length)
                    ? 'No tickets match this status.'
                    : 'No tickets in this project yet.';
                empty.style.display = 'block';
            }
            return;
        }
        if (empty) empty.style.display = 'none';

        tbody.innerHTML = tickets.map(t => {
            const closed = this._isClosed(t.statusID, t.status);
            return `
            <tr class="pjd-trow${closed ? ' is-closed' : ''}" data-ticket="${t.ticketID}"
                role="button" tabindex="0">
              <td class="pjd-tid mono">#${t.ticketID}</td>
              <td class="pjd-tsubj">${this._esc(t.subject ?? '')}</td>
              <td><span class="pjd-tstatus">${this._esc(t.status ?? '')}</span></td>
              <td class="pjd-ttype">${this._esc(t.requestType ?? '')}</td>
              <td class="pjd-ttech">${this._esc(t.assignedTechName || '—')}</td>
              <td class="pjd-tdate mono">${t.targetDate && !String(t.targetDate).startsWith('1900-01-01') ? this._fmtDate(t.targetDate) : '—'}</td>
              <td class="pjd-tact">${this._isAdmin && !closed ? `<button type="button" class="pjd-unassign" data-un="${t.ticketID}" title="Return this CR to the pool">Unassign</button>` : ''}</td>
            </tr>`;
        }).join('');

        tbody.querySelectorAll('.pjd-trow[data-ticket]').forEach(row =>
            row.addEventListener('click', () => this._openTicket(parseInt(row.dataset.ticket, 10))));

        // Unassign: send the CR back to the pool. The proc clears its target
        // date (pool tickets carry no deadline). stopPropagation so the row's
        // open-ticket click does not also fire.
        tbody.querySelectorAll('.pjd-unassign[data-un]').forEach(btn =>
            btn.addEventListener('click', async e => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.un, 10);
                if (!Number.isFinite(id)) return;
                if (!confirm(`Return ticket #${id} to the CR pool? Its target date will be cleared.`)) return;
                btn.disabled = true;
                try {
                    await API.post('Ticket/SetTicketProject',
                        API.authPayload({ ticketID: id, projectID: null }));
                    await this._load();
                } catch (err) {
                    console.error('ProjectDetails unassign:', err);
                    btn.disabled = false;
                }
            }));
    }

    // ---- CR pool picker: list unassigned CRs, add one to this project ----
    _wirePool() {
        const btn = document.getElementById('pjd-add-pool');
        if (!btn) return;
        btn.style.display = '';
        btn.addEventListener('click', () => this._togglePoolPicker());
    }

    async _togglePoolPicker() {
        const panel = document.getElementById('pjd-pool-picker');
        if (!panel) return;
        if (!panel.hidden) { panel.hidden = true; return; }
        panel.hidden = false;
        panel.innerHTML = '<p class="pjd-pool-empty">Loading\u2026</p>';
        try {
            const data = await API.post('Ticket/GetUnassignedCRs',
                API.authPayload({ myTicket: 0, filters: {} }));
            const rows = Array.isArray(data) ? data : [];
            if (!rows.length) {
                panel.innerHTML = '<p class="pjd-pool-empty">The CR pool is empty.</p>';
                return;
            }
            panel.innerHTML = rows.map(r => `
                <div class="pjd-pool-row">
                  <span class="pjd-pool-id mono">#${r.ticketID}</span>
                  <span class="pjd-pool-subj">${this._esc(r.subject ?? '')}</span>
                  <span class="pjd-pool-type">${this._esc(r.requestType ?? '')}</span>
                  <button type="button" class="pjd-pool-add" data-add="${r.ticketID}">Add</button>
                </div>`).join('');
            panel.querySelectorAll('.pjd-pool-add[data-add]').forEach(b =>
                b.addEventListener('click', async () => {
                    const id = parseInt(b.dataset.add, 10);
                    if (!Number.isFinite(id)) return;
                    b.disabled = true;
                    try {
                        await API.post('Ticket/SetTicketProject',
                            API.authPayload({ ticketID: id, projectID: parseInt(this.projectId, 10) }));
                        panel.hidden = true;
                        await this._load();
                    } catch (err) {
                        console.error('ProjectDetails add-from-pool:', err);
                        b.disabled = false;
                    }
                }));
        } catch (err) {
            console.error('ProjectDetails pool picker:', err);
            panel.innerHTML = '<p class="pjd-pool-empty">Couldn\u2019t load the pool.</p>';
        }
    }

    // Projects-a: client-side status filter over the already-loaded ticket
    // list. Populated from the distinct statuses present; hidden when there
    // is nothing worth filtering on.
    _setupStatusFilter() {
        const sel = document.getElementById('pjd-status-filter');
        if (!sel) return;
        const seen = new Set();
        const statuses = [];
        (this._allTickets || []).forEach(t => {
            const s = t.status ?? '';
            if (s && !seen.has(s)) { seen.add(s); statuses.push(s); }
        });
        if (statuses.length <= 1) { sel.hidden = true; return; }
        sel.innerHTML = '<option value="">All statuses</option>'
            + statuses.map(s => `<option value="${this._esc(s)}">${this._esc(s)}</option>`).join('');
        sel.hidden = false;
        if (!sel._bound) {
            sel.addEventListener('change',
                () => this._renderTickets(this._applyStatusFilter(this._allTickets)));
            sel._bound = true;
        }
    }

    _applyStatusFilter(list) {
        const sel = document.getElementById('pjd-status-filter');
        const val = sel && !sel.hidden ? sel.value : '';
        if (!val) return list || [];
        return (list || []).filter(t => String(t.status ?? '') === val);
    }

    _openTicket(ticketId) {
        if (!Number.isFinite(ticketId)) return;
        sessionStorage.setItem(STORAGE_KEYS.TICKET_ID, String(ticketId));
        // 6b: Back from a project ticket returns to this project, not the queue.
        sessionStorage.setItem('TicketListReturn', '/ProjectDetails');
        Router.toTicketDetails();
    }

    _renderError(msg) {
        const wrap = document.getElementById('pjd-body');
        if (wrap) wrap.innerHTML = `<p class="pj-empty">${this._esc(msg)}</p>`;
    }

    // ---- helpers ----
    _isClosed(statusId, statusName) {
        const n = String(statusName ?? '').toLowerCase();
        if (n === 'closed' || n === 'solved' || n === 'resolved') return true;
        return [3, 5].includes(Number(statusId));
    }
    _typeClass(t) {
        const k = String(t ?? '').toLowerCase();
        if (k === 'release') return 'release';
        if (k === 'maintenance') return 'maint';
        return 'internal';
    }
    _statusClass(s) {
        const k = String(s ?? '').toLowerCase();
        if (k === 'complete') return 'done';
        if (k === 'withdrawn') return 'wdn';
        if (k === 'active') return 'active';
        if (k === 'draft') return 'draft';
        return 'new';
    }
    _fmtDate(v) {
        const d = new Date(v);
        if (isNaN(d)) return '';
        return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    }
    _esc(s) {
        return String(s).replace(/[&<>"']/g, c =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
}

// -------------------------  Init  ------------------------- //
const projectDetails = new ProjectDetails();
document.addEventListener('DOMContentLoaded', () => projectDetails.init());
