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
            await this._load();
        } catch (error) {
            if (error.message !== 'Unauthorized') {
                this.handleError('Error initializing project details');
            }
        }
    }

    _wireBack() {
        document.getElementById('pjd-back')
            ?.addEventListener('click', () => Nav.toProjectsPage());
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
            this._renderHeader(data);
            this._renderTickets(data.tickets || []);
        } catch (err) {
            console.error('ProjectDetails._load:', err);
            this._renderError("Couldn't load this project. Please try again.");
        }
    }

    _renderHeader(p) {
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

        set('pjd-name', p.projectName ?? '');
        document.title = `${p.projectName ?? 'Project'} - Govtech HelpDesk`;

        const typeEl = document.getElementById('pjd-type');
        if (typeEl) {
            typeEl.textContent = p.projectType ?? '';
            typeEl.className = `pj-type pj-type--${this._typeClass(p.projectType)}`;
        }
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

        const open = p.openTicketCount ?? 0;
        const total = p.ticketCount ?? 0;
        set('pjd-ticket-count', `${open} open / ${total} total`);
    }

    _renderTickets(tickets) {
        const tbody = document.getElementById('pjd-ticket-rows');
        const empty = document.getElementById('pjd-tickets-empty');
        if (!tbody) return;

        if (!tickets.length) {
            tbody.innerHTML = '';
            if (empty) empty.style.display = 'block';
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
              <td class="pjd-tdate mono">${t.targetDate ? this._fmtDate(t.targetDate) : '—'}</td>
            </tr>`;
        }).join('');

        tbody.querySelectorAll('.pjd-trow[data-ticket]').forEach(row =>
            row.addEventListener('click', () => this._openTicket(parseInt(row.dataset.ticket, 10))));
    }

    _openTicket(ticketId) {
        if (!Number.isFinite(ticketId)) return;
        sessionStorage.setItem(STORAGE_KEYS.TICKET_ID, String(ticketId));
        Nav.toTicketDetails();
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
