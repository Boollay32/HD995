// =============================  Settings.js  ============================= //
// Gathers the app-wide preference controls (dark mode, text size, tab
// highlight) into one popover, opened from a gear button in the nav header
// beside Logout. Theme.js / FontSize.js / TabFocus.js each mount their own
// control into a labelled slot inside the panel; this module only builds the
// shell and handles open/close. Mirrors the poll-mount pattern of its siblings
// so it survives the nav being built asynchronously.

const Settings = {
    GEAR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',

    open: false,

    _panel() { return document.getElementById('qv-settings-panel'); },
    _btn()   { return document.getElementById('qv-settings-btn'); },

    show() {
        const p = this._panel(), b = this._btn();
        if (!p) return;
        p.removeAttribute('hidden');
        if (b) b.setAttribute('aria-expanded', 'true');
        this.open = true;
    },
    hide() {
        const p = this._panel(), b = this._btn();
        if (!p) return;
        p.setAttribute('hidden', '');
        if (b) b.setAttribute('aria-expanded', 'false');
        this.open = false;
    },
    toggle() { if (this.open) this.hide(); else this.show(); },

    mount() {
        const bar = document.querySelector('nav.Nav-Bar #navbar-logout');
        if (!bar || bar.querySelector('#qv-settings')) return !!bar;

        const wrap = document.createElement('div');
        wrap.className = 'qv-settings';
        wrap.id = 'qv-settings';
        wrap.innerHTML =
            '<button type="button" class="qv-settings-btn" id="qv-settings-btn" ' +
                'aria-label="Settings" aria-expanded="false" aria-controls="qv-settings-panel">' +
                this.GEAR + '</button>' +
            '<div class="qv-settings-panel" id="qv-settings-panel" hidden>' +
                '<div class="qv-set-title">Settings</div>' +
                '<div class="qv-set-row">' +
                    '<span class="qv-set-lbl">Dark mode</span>' +
                    '<span class="qv-set-slot" data-set-slot="theme"></span>' +
                '</div>' +
                '<div class="qv-set-row">' +
                    '<span class="qv-set-lbl">Text size</span>' +
                    '<span class="qv-set-slot" data-set-slot="font"></span>' +
                '</div>' +
                '<div class="qv-set-row">' +
                    '<span class="qv-set-lbl">Tab highlight' +
                        '<small>focus outline when tabbing</small></span>' +
                    '<span class="qv-set-slot" data-set-slot="tabfocus"></span>' +
                '</div>' +
            '</div>';
        bar.insertBefore(wrap, bar.firstChild);

        wrap.querySelector('#qv-settings-btn')
            .addEventListener('click', (e) => { e.stopPropagation(); Settings.toggle(); });
        wrap.querySelector('#qv-settings-panel')
            .addEventListener('click', (e) => e.stopPropagation());
        document.addEventListener('click', () => { if (Settings.open) Settings.hide(); });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && Settings.open) Settings.hide();
        });
        return true;
    },

    boot() {
        PersistedToggle.pollMount(() => this.mount(), '#qv-settings');
    }
};

document.addEventListener('DOMContentLoaded', () => Settings.boot());
if (typeof window !== 'undefined') window.Settings = Settings;
