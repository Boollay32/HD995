// =============================  Snow.js  ============================= //
// Seasonal snow, user-controllable. Falling flakes run ONLY over the nav bar
// (SnowEffect navbarOnly); rested drifts (Snow.css, gated on
// html[data-snow="on"]) sit along the navbar's bottom edge and on project
// cards. Default is on during the festive window (Dec 1 - Jan 7) and off the
// rest of the year; the setting overrides the season BOTH ways and persists.
// Mounts a switch into the settings panel, mirroring TabFocus.js.

const Snow = {
    KEY: 'hd32-snow',
    FLAKE: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 3v18M5 6.5l14 11M19 6.5l-14 11M12 3l-2 2M12 3l2 2M12 21l-2-2M12 21l2-2"/></svg>',

    _fx: null,

    _get() { return PersistedToggle.get(this.KEY); },
    _set(v) { PersistedToggle.set(this.KEY, v); },

    _inSeason() {
        const now = new Date();
        return now.getMonth() === 11 || (now.getMonth() === 0 && now.getDate() <= 7);
    },

    initial() {
        const saved = this._get();
        if (saved === 'on' || saved === 'off') return saved;
        return this._inSeason() ? 'on' : 'off';
    },

    apply(v) {
        if (v !== 'on') v = 'off';
        document.documentElement.setAttribute('data-snow', v);
        this._set(v);

        // Falling flakes: construct with enabled:false so SnowEffect's own
        // seasonal gate never runs - the toggle IS the gate here.
        if (v === 'on') {
            if (!this._fx && typeof SnowEffect !== 'undefined') {
                // The login page hides the app nav (#nav display:none) and
                // gets the sparse full-page fall instead, behind the card.
                const loginPage = !!document.querySelector('.auth-container');
                this._fx = new SnowEffect({ enabled: false, navbarOnly: !loginPage, snowflakeCount: loginPage ? 30 : 28 });
            }
            if (this._fx && !this._fx.snowContainer) this._fx.init();
        } else if (this._fx) {
            this._fx.stop();
        }

        document.querySelectorAll('.qv-snow-sw').forEach(s =>
            s.setAttribute('aria-checked', String(v === 'on')));
    },

    toggle() {
        this.apply(document.documentElement.getAttribute('data-snow') === 'on' ? 'off' : 'on');
    },

    mount() {
        const slot = document.querySelector('#qv-settings-panel [data-set-slot="snow"]');
        if (!slot || slot.querySelector('.qv-snow')) return !!slot;
        // span, not label: see Theme.js - empty <label> is a WAVE error.
        const wrap = document.createElement('span');
        wrap.className = 'qv-snow';
        wrap.innerHTML = '<button type="button" class="qv-snow-sw" role="switch" ' +
            'aria-label="Toggle snow"><span class="qv-snow-knob">' + this.FLAKE + '</span></button>';
        slot.appendChild(wrap);
        wrap.querySelector('.qv-snow-sw').addEventListener('click', () => Snow.toggle());
        this.apply(this.initial());
        return true;
    },

    boot() {
        this.apply(this.initial());   // set the attribute (and flakes) early
        PersistedToggle.pollMount(() => this.mount(), '.qv-snow');
    }
};

document.addEventListener('DOMContentLoaded', () => Snow.boot());
if (typeof window !== 'undefined') window.Snow = Snow;
