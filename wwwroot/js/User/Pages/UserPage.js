// =============================  UserPage.js  ============================= //
// The users list, on the shared QueueView engine. Read-only navigation:
// opening a row goes to UserDetails (where editing happens, behind the
// server-side Govtech-admin guard). Authority scoping is enforced server-side,
// so this config simply renders whatever GetUsers returns for the caller.

// -------------------------  Presentation helpers  ------------------------- //

const UQ_ROLE_LABELS = { '0': 'Authority', '1': 'Govtech', '2': 'Admin', '4': 'RFC only' };
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
            // GDPR-scrubbed accounts: the DB-side scrub writes these literal
            // placeholders into the name/email. They are not users any more
            // -- dropping them here removes them from the queue, the search
            // and every filter chip in one place.
            if (this._isScrubbed(r)) continue;
            rows.push(r);
        }
        return rows;
    }

    _isScrubbed(r) {
        const n = String(r.userName ?? '').trim();
        const e = String(r.email ?? '').trim();
        return n === 'GDPR - user removed' || e === 'GDPR - Email removed';
    }

    _open(row) {
        sessionStorage.setItem(STORAGE_KEYS.USER_ID, row.userID);
        // Store the ops key only when the row HAS an email; otherwise CLEAR
        // it. Storing a missing value wrote the literal string "undefined"
        // (the "undefined could not be reset" bug), and merely skipping
        // would leak the previously viewed user's login into this user's
        // reset/delete/update -- the wrong account would be operated on.
        // GetUserDetail re-stamps the canonical login on load (HD41 7a).
        if (row.email) {
            sessionStorage.setItem(STORAGE_KEYS.VIEW_USER_LOGIN, row.email);
        } else {
            sessionStorage.removeItem(STORAGE_KEYS.VIEW_USER_LOGIN);
        }
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
                    render: r => `<div class="qv-assignee"><span class="qv-av" style="background:${UI.avatarColor(r.userName)}">${Format.initials(r.userName)}</span><div><div class="s1">${Format.escapeHtml(r.userName)}</div>${r.email ? `<div class="s2">${Format.escapeHtml(r.email)}</div>` : ''}</div></div>`
                },
                {
                    key: 'authority', label: 'Authority', sortable: true,
                    sortValue: r => (r.authority || '').toLowerCase(),
                    render: r => `<span class="qv-badge">${Format.escapeHtml(r.authority)}</span>`
                },
                {
                    key: 'adminLevel', label: 'Role',
                    render: r => `<span class="qv-prio">${Format.escapeHtml(UQrole(r.adminLevel))}</span>`
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

            previewHeader: r => `<div class="qv-pv-tid">${Format.escapeHtml(r.authority)}</div><div class="qv-pv-title">${Format.escapeHtml(r.userName)}</div>
                <div class="qv-pv-meta"><span class="qv-pv-chip"><span class="qv-pv-chip-label">Role</span><span class="qv-badge">${Format.escapeHtml(UQrole(r.adminLevel))}</span></span></div>`,
            preview: r => {
                const s = UQstatus(r);
                return `<h3 class="qv-pv-h">Contact</h3>
                    <div class="qv-pv-dl">
                      <span class="qv-pv-dt">Email</span><span class="qv-pv-dd">${r.email ? Format.escapeHtml(r.email) : '\u2014'}</span>
                      <span class="qv-pv-dt">Phone</span><span class="qv-pv-dd">${r.phone ? Format.escapeHtml(r.phone) : '\u2014'}</span>
                    </div>
                    <h3 class="qv-pv-h">Account</h3>
                    <div class="qv-pv-dl">
                      <span class="qv-pv-dt">Status</span><span class="qv-pv-dd"><span class="qv-status" style="color:${s.color};background:${s.bg}">${s.label}</span></span>
                      <span class="qv-pv-dt">Role</span><span class="qv-pv-dd">${Format.escapeHtml(UQrole(r.adminLevel))}</span>
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
