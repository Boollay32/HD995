// =============================  FontSize.js  ============================= //
// Three app-wide text sizes: small (default / current), medium, large. Sets
// data-font on <html>, persists the choice, and injects a 3-way control into
// the nav header. Mirrors Theme.js. Sizes scale because the CSS uses rem and
// the root font-size is set per data-font in tokens.css.

const FontSize = {
    KEY: 'hd32-fontsize',
    SIZES: ['small', 'medium', 'large'],
    LABEL: { small: 'A', medium: 'A', large: 'A' },

    _get() { try { return localStorage.getItem(this.KEY); } catch (e) { return null; } },
    _set(v) { try { localStorage.setItem(this.KEY, v); } catch (e) {} },

    initial() {
        const saved = this._get();
        return this.SIZES.includes(saved) ? saved : 'small';
    },

    apply(v) {
        if (!this.SIZES.includes(v)) v = 'small';
        // 'small' is the default (no attribute needed), but set it explicitly
        // so the control state and persistence stay simple.
        if (v === 'small') document.documentElement.removeAttribute('data-font');
        else document.documentElement.setAttribute('data-font', v);
        this._set(v);
        document.querySelectorAll('.qv-font-opt').forEach(b => {
            b.setAttribute('aria-pressed', String(b.dataset.size === v));
        });
        const lbl = v[0].toUpperCase() + v.slice(1);
        document.querySelectorAll('.qv-font-lbl').forEach(l => { l.textContent = lbl; });
    },

    set(v) { this.apply(v); },

    mount() {
        const bar = document.querySelector('#qv-settings-panel [data-set-slot="font"]');
        if (!bar || bar.querySelector('.qv-font')) return !!bar;
        const wrap = document.createElement('div');
        wrap.className = 'qv-font';
        wrap.setAttribute('role', 'group');
        wrap.setAttribute('aria-label', 'Text size');
        wrap.innerHTML = '<span class="qv-font-lbl"></span>' + this.SIZES.map(s =>
            '<button type="button" class="qv-font-opt" data-size="' + s +
            '" aria-label="' + s[0].toUpperCase() + s.slice(1) + ' text" title="' +
            s[0].toUpperCase() + s.slice(1) + '">A</button>'
        ).join('');
        bar.appendChild(wrap);
        wrap.querySelectorAll('.qv-font-opt').forEach(b =>
            b.addEventListener('click', () => FontSize.set(b.dataset.size)));
        this.apply(this.initial());
        return true;
    },

    boot() {
        this.apply(this.initial());
        let tries = 0;
        const timer = setInterval(() => {
            if (this.mount() && document.querySelector('.qv-font')) clearInterval(timer);
            if (++tries > 60) clearInterval(timer);
        }, 50);
    }
};

document.addEventListener('DOMContentLoaded', () => FontSize.boot());
if (typeof window !== 'undefined') window.FontSize = FontSize;
