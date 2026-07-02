// =============================  DeadlineWindows.js  ============================= //
// User-configurable deadline warning windows, expressed as a PERCENTAGE of an
// item's own created->due timeline remaining (so a 3-day task and a 6-month
// project share one rule): amber when remaining% <= amber, red when <= red or
// overdue. Consumed by DashboardPage._deadline(); mounts two number inputs
// into the Settings popover (data-set-slot="deadline"), persisted via the
// PersistedToggle localStorage wrapper like its Theme/FontSize siblings.

'use strict';

const DeadlineWindows = {

    KEY_AMBER: 'DeadlineAmberPct',
    KEY_RED: 'DeadlineRedPct',
    DEFAULT_AMBER: 25,
    DEFAULT_RED: 10,

    _clamp(v, lo, hi, dflt) {
        const n = parseInt(v, 10);
        if (Number.isNaN(n)) return dflt;
        return Math.min(hi, Math.max(lo, n));
    },

    // Always returns a sane pair: 1 <= red < amber <= 90.
    get() {
        let amber = this._clamp(PersistedToggle.get(this.KEY_AMBER), 2, 90, this.DEFAULT_AMBER);
        let red = this._clamp(PersistedToggle.get(this.KEY_RED), 1, 89, this.DEFAULT_RED);
        if (red >= amber) red = Math.max(1, amber - 1);
        return { amber, red };
    },

    _input(id, value) {
        return `<input type="number" class="qv-set-num" id="${id}" ` +
            `min="1" max="90" step="1" value="${value}" inputmode="numeric">`;
    },

    mount() {
        const slot = document.querySelector('[data-set-slot="deadline"]');
        if (!slot || slot.querySelector('input')) return !!slot;

        const { amber, red } = this.get();
        slot.innerHTML =
            '<span class="qv-set-num-pair">' +
                '<label class="qv-set-num-lbl">amber ' + this._input('dlw-amber', amber) + '%</label>' +
                '<label class="qv-set-num-lbl">red ' + this._input('dlw-red', red) + '%</label>' +
            '</span>';

        const save = () => {
            const a = this._clamp(document.getElementById('dlw-amber')?.value, 2, 90, this.DEFAULT_AMBER);
            let r = this._clamp(document.getElementById('dlw-red')?.value, 1, 89, this.DEFAULT_RED);
            if (r >= a) r = Math.max(1, a - 1);
            PersistedToggle.set(this.KEY_AMBER, String(a));
            PersistedToggle.set(this.KEY_RED, String(r));
            const ai = document.getElementById('dlw-amber');
            const ri = document.getElementById('dlw-red');
            if (ai) ai.value = a;
            if (ri) ri.value = r;
        };
        slot.querySelectorAll('input').forEach(i => i.addEventListener('change', save));
        return true;
    },

    boot() {
        PersistedToggle.pollMount(() => this.mount(), '[data-set-slot="deadline"] input');
    },
};

document.addEventListener('DOMContentLoaded', () => DeadlineWindows.boot());
if (typeof window !== 'undefined') window.DeadlineWindows = DeadlineWindows;
