// =============================  TabFocus.js  ============================= //
// Toggles the keyboard focus outline ("tab highlight") app-wide. OFF by
// default -- the focus rings only show once a user opts in. Sets
// data-tabfocus="on" on <html> when enabled; the suppressor rule in tokens.css
// hides every :focus-visible outline whenever the attribute is absent. Mounts a
// switch into the settings panel, mirroring Theme.js.

const TabFocus = {
    KEY: 'hd32-tabfocus',

    _get() { return PersistedToggle.get(this.KEY); },
    _set(v) { PersistedToggle.set(this.KEY, v); },

    initial() {
        const saved = this._get();
        return (saved === 'on' || saved === 'off') ? saved : 'off';
    },

    apply(v) {
        if (v !== 'on') v = 'off';
        if (v === 'on') document.documentElement.setAttribute('data-tabfocus', 'on');
        else document.documentElement.removeAttribute('data-tabfocus');
        this._set(v);
        document.querySelectorAll('.qv-tf-sw').forEach(s =>
            s.setAttribute('aria-checked', String(v === 'on')));
    },

    toggle() {
        this.apply(document.documentElement.getAttribute('data-tabfocus') === 'on' ? 'off' : 'on');
    },

    mount() {
        const slot = document.querySelector('#qv-settings-panel [data-set-slot="tabfocus"]');
        if (!slot || slot.querySelector('.qv-tabfocus')) return !!slot;
        // span, not label: see Theme.js -- empty <label> is a WAVE error.
        const wrap = document.createElement('span');
        wrap.className = 'qv-tabfocus';
        wrap.innerHTML = '<button type="button" class="qv-tf-sw" role="switch" ' +
            'aria-label="Toggle tab highlight"><span class="qv-tf-knob"></span></button>';
        slot.appendChild(wrap);
        wrap.querySelector('.qv-tf-sw').addEventListener('click', () => TabFocus.toggle());
        this.apply(this.initial());
        return true;
    },

    boot() {
        this.apply(this.initial());
        PersistedToggle.pollMount(() => this.mount(), '.qv-tabfocus');
    }
};

document.addEventListener('DOMContentLoaded', () => TabFocus.boot());
if (typeof window !== 'undefined') window.TabFocus = TabFocus;
