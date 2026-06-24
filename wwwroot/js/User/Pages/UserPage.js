// =============================  UserPage.js  ============================= //
// The users list, on the shared QueueView engine. Read-only navigation:
// opening a row goes to UserDetails (where editing happens, behind the
// server-side Govtech-admin guard). Authority scoping is enforced server-side,
// so this config simply renders whatever GetUsers returns for the caller.

// -------------------------  Presentation helpers  ------------------------- //

const UQ_ROLE_LABELS = { '0': 'Authority', '1': 'Govtech', '2': 'Admin', '4': 'RFC only' };
const UQ_AV_PALETTE = ['#5A6470', '#1E51C0', '#A25A06', '#6D28C9', '#B23121', '#0E6E80'];

const UQesc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const UQinitials = n => (n || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
const UQavColor = n => { let h = 0; for (const c of (n || '')) h = c.charCodeAt(0) + ((h << 5) - h); return UQ_AV_PALETTE[Math.abs(h) % UQ_AV_PALETTE.length]; };
const UQrole = v => UQ_ROLE_LABELS[String(v ?? '').trim()] ?? (v || '—');
// locked: 0/empty = active, 99 = deactivated, anything else = locked
const UQstatus = r => {
    const l = Number(r.locked) || 0;   // tolerate string/null wire values
    if (l === 99) return { label: 'Deactivated', color: 'var(--neutral-fg)', bg: 'var(--neutral-bg)' };
    if (l) return { label: 'Locked', color: 'var(--bad-fg)', bg: 'var(--bad-bg)' };
    return { label: 'Active', color: 'var(--ok-fg)', bg: 'var(--ok-bg)' };
};
const UQdate = iso => {
    if (!iso) return 'Never';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

// -------------------------  Page  ------------------------- //

class UserPage extends PageBase {
    constructor() {
        super('User');
        this.queue = null;
    }

    async init() {
        if (!await this.checkAuth()) return;
        if (typeof SetActivePage === 'function') SetActivePage('UserMenu');
        // HD37 2a: gate the nav menu like every other queue page. Without this
        // the menu's permission check never runs here, so the post-HD36
        // default-hide left the menu permanently blank on the Users page.
        if (typeof UserPermissions === 'function') UserPermissions();

        try {
            await this.waitForElement('queue-mount');
        } catch {
            this.handleError('Page elements failed to load.');
            return;
        }

        // Govtech admins (level 2) can create users; the server also enforces this.
        const adminId = await API.post('Authenticator/CheckAdmin', API.authPayload());
        const cfg = this._config();
        if (parseInt(adminId, 10) === 2) {
            cfg.action = { label: '+ New User', onClick: () => Router.toCreateUser() };
        }
        this.queue = new QueueView('#queue-mount', cfg);
        await this.queue.load();
    }

    async _fetch() {
        // usp_Helpdesk_GetUsers EXCLUDES deactivated accounts (UserLocked = 99)
        // unless asked for exactly those -- there is no "everyone" parameter.
        // Fetch both sets in parallel and merge, so deactivated users are
        // visible too. If the server ignores the Locked filter, the second
        // call returns the default set and the userID dedupe is a no-op.
        const [current, deactivated] = await Promise.all([
            API.post('User/GetUsers', API.authPayload({ filters: {} })),
            API.post('User/GetUsers', API.authPayload({ filters: { Locked: '99' } }))
                .catch(() => []),
        ]);

        const rows = [];
        const seen = new Set();
        for (const r of [...(Array.isArray(current) ? current : []),
                         ...(Array.isArray(deactivated) ? deactivated : [])]) {
            const key = String(r.userID ?? '');
            if (!key || seen.has(key)) continue;
            seen.add(key);
            rows.push(r);
        }
        return rows;
    }

    _open(row) {
        sessionStorage.setItem(STORAGE_KEYS.USER_ID, row.userID);
        this.navigateToUserDetails();
    }

    _config() {
        return {
            title: 'Users',
            fetch: () => this._fetch(),
            rowKey: r => r.userID,
            search: ['userName', 'email', 'authority'],

            views: [
                { id: 'active', label: 'Active',  filter: r => !Number(r.locked) },
                { id: 'locked', label: 'Locked',  warn: true, filter: r => { const l = Number(r.locked); return !!l && l !== 99; } },
                { id: 'deactivated', label: 'Deactivated', filter: r => Number(r.locked) === 99 },
            ],

            filters: [
                { id: 'auth', label: 'Authority', field: 'authority' },
                { id: 'role', label: 'Role',      field: 'adminLevel' },
            ],

            columns: [
                {
                    key: 'userName', label: 'Name', sortable: true,
                    sortValue: r => (r.userName || '').toLowerCase(),
                    render: r => `<div class="qv-assignee"><span class="qv-av" style="background:${UQavColor(r.userName)}">${UQinitials(r.userName)}</span><div><div class="s1">${UQesc(r.userName)}</div>${r.email ? `<div class="s2">${UQesc(r.email)}</div>` : ''}</div></div>`
                },
                {
                    key: 'authority', label: 'Authority', sortable: true,
                    sortValue: r => (r.authority || '').toLowerCase(),
                    render: r => `<span class="qv-badge">${UQesc(r.authority)}</span>`
                },
                {
                    key: 'adminLevel', label: 'Role',
                    render: r => `<span class="qv-prio">${UQesc(UQrole(r.adminLevel))}</span>`
                },
                {
                    key: 'lastLoginDate', label: 'Last login', sortable: true,
                    sortValue: r => new Date(r.lastLoginDate).getTime() || 0,
                    render: r => `<span class="qv-updated">${UQdate(r.lastLoginDate)}</span>`
                },
                {
                    key: 'locked', label: 'Status',
                    render: r => { const s = UQstatus(r); return `<span class="qv-status" style="color:${s.color};background:${s.bg}">${s.label}</span>`; }
                },
            ],

            defaultSort: { key: 'userName', dir: 1 },

            previewHeader: r => `<div class="qv-pv-tid">${UQesc(r.authority)}</div><div class="qv-pv-title">${UQesc(r.userName)}</div>
                <div class="qv-pv-meta"><span class="qv-pv-chip"><span class="qv-pv-chip-label">Role</span><span class="qv-badge">${UQesc(UQrole(r.adminLevel))}</span></span></div>`,
            preview: r => {
                const s = UQstatus(r);
                return `<h3 class="qv-pv-h">Contact</h3>
                    <div class="qv-pv-dl">
                      <span class="qv-pv-dt">Email</span><span class="qv-pv-dd">${r.email ? UQesc(r.email) : '\u2014'}</span>
                      <span class="qv-pv-dt">Phone</span><span class="qv-pv-dd">${r.phone ? UQesc(r.phone) : '\u2014'}</span>
                    </div>
                    <h3 class="qv-pv-h">Account</h3>
                    <div class="qv-pv-dl">
                      <span class="qv-pv-dt">Status</span><span class="qv-pv-dd"><span class="qv-status" style="color:${s.color};background:${s.bg}">${s.label}</span></span>
                      <span class="qv-pv-dt">Role</span><span class="qv-pv-dd">${UQesc(UQrole(r.adminLevel))}</span>
                      <span class="qv-pv-dt">Last login</span><span class="qv-pv-dd">${UQdate(r.lastLoginDate)}</span>
                    </div>`;
            },
            onOpen: r => this._open(r),
        };
    }
}

// -------------------------  Init  ------------------------- //

const userPage = new UserPage();
document.addEventListener('DOMContentLoaded', () => userPage.init());
if (typeof window !== 'undefined') window.userPage = userPage;
