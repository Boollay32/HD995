// =============================  ProjectsPage.js  ============================= //
// The Projects list: the boundary/home for internal work. Shows one card per
// project with roll-up counts. Opening a card goes to the project detail page.

class ProjectsPage extends PageBase {
    constructor() {
        super();
        this.statusFilter = 2;      // default view: Active (2); null = All
        this.projects = [];
        this.searchQuery = '';      // live search over the loaded set
    }

    async init() {
        if (!await this.checkAuth()) return;
        try {
            SetActivePage('ProjectsMenu');
            if (typeof UserPermissions === 'function') UserPermissions();
            this._wireFilters();
            this._wireSearch();
            document.getElementById('pj-pool')
                ?.addEventListener('click', () => Router.toCRPoolPage());
            await this._setupNew();
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

    _wireSearch() {
        const input = document.getElementById('pj-search');
        const wrap = document.getElementById('pj-search-wrap');
        const clear = document.getElementById('pj-search-clear');
        if (!input) return;
        const apply = () => {
            this.searchQuery = input.value.trim();
            wrap?.classList.toggle('has-value', this.searchQuery.length > 0);
            this._render();
        };
        input.addEventListener('input', apply);
        input.addEventListener('keydown', e => {
            if (e.key === 'Escape') { input.value = ''; apply(); }
        });
        clear?.addEventListener('click', () => { input.value = ''; input.focus(); apply(); });
    }

    async _setupNew() {
        // Only Govtech Admins (level 2) can create projects.
        try {
            const level = await AdminContext.resolve();
            if (level === 2) {
                const btn = document.getElementById('pj-new');
                if (btn) {
                    btn.style.display = '';
                    btn.addEventListener('click', () => {
                        sessionStorage.removeItem('EditProjectID');
                        Router.toProjectForm();
                    });
                }
            }
        } catch (err) { console.error('ProjectsPage._setupNew:', err); }
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

        // Live search over the loaded (status-filtered) set: name, owner, type.
        const q = this.searchQuery;
        const norm = s => String(s ?? '').trim().toLowerCase();
        const rows = !q ? this.projects : this.projects.filter(p =>
            [p.projectName, p.ownerName, p.projectType].some(v => norm(v).includes(norm(q))));

        const countEl = document.getElementById('pj-result-count');
        if (countEl) {
            countEl.textContent = q
                ? `${rows.length} of ${this.projects.length} project${this.projects.length === 1 ? '' : 's'} match “${q}”`
                : '';
        }

        if (!rows.length) {
            grid.innerHTML = q
                ? `<p class="pj-empty">No projects match “${this._esc(q)}”. <button type="button" id="pj-clear-inline">Clear search</button></p>`
                : `<p class="pj-empty">No projects to show.</p>`;
            document.getElementById('pj-clear-inline')?.addEventListener('click', () => {
                const input = document.getElementById('pj-search');
                if (input) { input.value = ''; input.dispatchEvent(new Event('input')); input.focus(); }
            });
            return;
        }

        grid.innerHTML = rows.map(p => this._card(p)).join('');
        grid.querySelectorAll('.pj-card[data-id]').forEach(card =>
            card.addEventListener('click', () => this._open(parseInt(card.dataset.id, 10))));
    }

    _card(p) {
        const pct = Number.isFinite(p.completionPct) ? p.completionPct : 0;
        const type = this._hl(p.projectType ?? '');
        const typeClass = this._typeClass(p.projectType);
        const name = this._hl(p.projectName ?? '');
        const target = p.targetDate ? this._fmtDate(p.targetDate) : 'No target date';
        const tickets = p.ticketCount ?? 0;
        const openTickets = p.openTicketCount ?? 0;
        const tasks = p.taskCount ?? 0;
        const owner = this._hl(p.ownerName ?? '');
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
        Router.toProjectDetail();
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
    // Escape, and wrap the first case-insensitive occurrence of the current
    // search query in <mark> so cards show why they matched.
    _hl(s) {
        const text = String(s ?? '');
        const q = this.searchQuery;
        if (!q) return this._esc(text);
        const i = text.toLowerCase().indexOf(q.toLowerCase());
        if (i === -1) return this._esc(text);
        return this._esc(text.slice(0, i))
            + '<mark>' + this._esc(text.slice(i, i + q.length)) + '</mark>'
            + this._esc(text.slice(i + q.length));
    }

    _esc(s) {
        return String(s).replace(/[&<>"']/g, c =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
}

// -------------------------  Init  ------------------------- //
const projectsPage = new ProjectsPage();
document.addEventListener('DOMContentLoaded', () => projectsPage.init());