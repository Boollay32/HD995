// =============================  ProjectsPage.js  ============================= //
// The Projects list: the boundary/home for internal work. Shows one card per
// project with roll-up counts. Opening a card goes to the project detail page.

class ProjectsPage extends PageBase {
    constructor() {
        super();
        this.statusFilter = null;   // null = active set (handled server-side default)
        this.projects = [];
    }

    async init() {
        if (!await this.checkAuth()) return;
        try {
            SetActivePage('ProjectsMenu');
            if (typeof UserPermissions === 'function') UserPermissions();
            this._wireFilters();
            await this._load();
        } catch (error) {
            if (error.message !== 'Unauthorized') {
                this.handleError('Error initializing projects page');
            }
        }
    }

    _wireFilters() {
        document.querySelectorAll('.pj-filter[data-status]').forEach(btn =>
            btn.addEventListener('click', () => {
                const raw = btn.dataset.status;
                this.statusFilter = raw === '' ? null : parseInt(raw, 10);
                document.querySelectorAll('.pj-filter').forEach(b => b.classList.remove('is-active'));
                btn.classList.add('is-active');
                this._load();
            }));
    }

    async _load() {
        const grid = document.getElementById('pj-grid');
        if (grid) grid.setAttribute('aria-busy', 'true');
        try {
            const data = await API.post('Project/GetProjects',
                API.authPayload({ statusId: this.statusFilter }));
            this.projects = Array.isArray(data) ? data : [];
            this._render();
        } catch (err) {
            console.error('ProjectsPage._load:', err);
            this._renderError();
        } finally {
            if (grid) grid.removeAttribute('aria-busy');
        }
    }

    _render() {
        const grid = document.getElementById('pj-grid');
        if (!grid) return;

        if (!this.projects.length) {
            grid.innerHTML = `<p class="pj-empty">No projects to show.</p>`;
            return;
        }

        grid.innerHTML = this.projects.map(p => this._card(p)).join('');
        grid.querySelectorAll('.pj-card[data-id]').forEach(card =>
            card.addEventListener('click', () => this._open(parseInt(card.dataset.id, 10))));
    }

    _card(p) {
        const pct = Number.isFinite(p.completionPct) ? p.completionPct : 0;
        const type = this._esc(p.projectType ?? '');
        const typeClass = this._typeClass(p.projectType);
        const name = this._esc(p.projectName ?? '');
        const target = p.targetDate ? this._fmtDate(p.targetDate) : 'No target date';
        const tickets = p.ticketCount ?? 0;
        const openTickets = p.openTicketCount ?? 0;
        const tasks = p.taskCount ?? 0;
        const owner = this._esc(p.ownerName ?? '');
        const status = this._esc(p.status ?? '');
        const statusClass = this._statusClass(p.status);

        return `
        <div class="pj-card" data-id="${p.projectID}" role="button" tabindex="0"
             aria-label="Open project ${name}">
          <div class="pj-card-top">
            <span class="pj-name">${name}</span>
            <span class="pj-type pj-type--${typeClass}">${type}</span>
          </div>
          <div class="pj-sub">
            <span class="pj-status pj-status--${statusClass}">${status}</span>
            <span class="pj-target">${target}</span>
          </div>
          <div class="pj-counts">
            <span><strong>${openTickets}</strong> open / ${tickets} tickets</span>
            <span><strong>${tasks}</strong> tasks</span>
          </div>
          <div class="pj-bar" role="progressbar" aria-valuenow="${pct}"
               aria-valuemin="0" aria-valuemax="100">
            <div class="pj-bar-fill" style="width:${pct}%"></div>
          </div>
          <div class="pj-foot">
            <span class="pj-pct">${pct}% complete</span>
            ${owner ? `<span class="pj-owner">${owner}</span>` : ''}
          </div>
        </div>`;
    }

    _open(projectId) {
        if (!Number.isFinite(projectId)) return;
        sessionStorage.setItem('ProjectID', String(projectId));
        Nav.toProjectDetail();
    }

    _renderError() {
        const grid = document.getElementById('pj-grid');
        if (grid) grid.innerHTML = `<p class="pj-empty">Couldn't load projects. Please try again.</p>`;
    }

    // ---- helpers ----
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
const projectsPage = new ProjectsPage();
document.addEventListener('DOMContentLoaded', () => projectsPage.init());
