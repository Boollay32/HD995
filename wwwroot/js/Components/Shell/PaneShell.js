// =====================  PaneShell.js  ===================== //
// Generic two-pane collapse manager, extracted from TicketShell.js (Stage A).
// One pane is always on screen: collapsing a pane while its sibling is
// collapsed re-opens the sibling, and persisted both-collapsed state is
// sanitised on restore. Pair with Components/PaneShell.css.
//
// Usage (globals, no modules):
//   const shell = new PaneShell({
//       left:  { pane: 'pane-left',  btn: 'collapse-left',  rail: 'rail-left'  },
//       right: { pane: 'pane-right', btn: 'collapse-right', rail: 'rail-right' },
//       storageKey: STORAGE_KEYS.TD_PANES_COLLAPSED,
//   });
//   shell.init();
// `shell.collapsed` is mutated in place, so callers may hold a live reference.

'use strict';

class PaneShell {

    constructor({ left, right, storageKey }) {
        this._ids = { left, right };
        this._storageKey = storageKey;
        this.collapsed = { left: false, right: false };
    }

    // -------------------------  DOM  ------------------------- //

    _els(side) {
        const ids = this._ids[side];
        return {
            pane: document.getElementById(ids.pane),
            btn:  document.getElementById(ids.btn),
            rail: ids.rail ? document.getElementById(ids.rail) : null,
        };
    }

    // -------------------------  Apply  ------------------------- //

    _apply(side, collapsed) {
        this.collapsed[side] = collapsed;
        const { pane, btn, rail } = this._els(side);
        if (!pane || !btn) return;

        if (collapsed) {
            pane.classList.add('is-collapsed');
            btn.setAttribute('aria-expanded', 'false');
            rail?.removeAttribute('hidden');
        } else {
            pane.classList.remove('is-collapsed');
            btn.setAttribute('aria-expanded', 'true');
            rail?.setAttribute('hidden', '');
        }
    }

    // -------------------------  Toggle  ------------------------- //

    // Programmatic collapse for arrival defaults: applies without
    // persisting, so it never overwrites the user's saved preference.
    collapse(side) {
        const other = side === 'left' ? 'right' : 'left';
        if (this.collapsed[other]) this._apply(other, false);
        this._apply(side, true);
    }

    toggle(side) {
        const other = side === 'left' ? 'right' : 'left';
        const next = !this.collapsed[side];
        // One pane must stay on screen: collapsing this one re-opens the other.
        if (next && this.collapsed[other]) this._apply(other, false);
        this._apply(side, next);
        this._persist();
    }

    // -------------------------  Persistence  ------------------------- //

    _persist() {
        if (!this._storageKey) return;
        sessionStorage.setItem(this._storageKey, JSON.stringify(this.collapsed));
    }

    _restore() {
        if (!this._storageKey) return;
        try {
            const saved = sessionStorage.getItem(this._storageKey);
            if (!saved) return;
            const parsed = JSON.parse(saved);
            // Sanitise legacy state: never restore with both panes collapsed.
            if (parsed.left && parsed.right) parsed.right = false;
            if (parsed.left) this._apply('left', true);
            if (parsed.right) this._apply('right', true);
        } catch {
            // Ignore malformed session data
        }
    }

    // -------------------------  Bind / init  ------------------------- //

    bind() {
        for (const side of ['left', 'right']) {
            const { btn, rail } = this._els(side);
            btn?.addEventListener('click', () => this.toggle(side));
            // Rail click expands pane
            rail?.addEventListener('click', () => {
                if (this.collapsed[side]) this.toggle(side);
            });
        }
    }

    init() {
        this.bind();
        this._restore();
    }

    // -------------------------  Resize (draggable split)  ------------------------- //

    // ids: { shell, divider }, colsKey: sessionStorage key for the ratio.
    // MIN/MAX bound the left pane to 30%-70%; dragging past collapses it.
    initResize({ shell, divider, colsKey }) {
        this._shellEl = document.getElementById(shell);
        this._dividerEl = document.getElementById(divider);
        this._colsKey = colsKey;
        if (!this._shellEl || !this._dividerEl) return;

        this._MINPCT = 30;
        this._MAXPCT = 70;
        this._restoreCols();

        const onMove = (e) => {
            const rect = this._shellEl.getBoundingClientRect();
            if (rect.width <= 0) return;
            const pct = ((e.clientX - rect.left) / rect.width) * 100;
            // Past the bounds -> collapse that pane and end the drag.
            if (pct < this._MINPCT) { this._endDrag(); this.toggleViaDrag('left'); return; }
            if (pct > this._MAXPCT) { this._endDrag(); this.toggleViaDrag('right'); return; }
            this._setCols(pct);
        };
        const onUp = () => {
            this._endDrag();
            this._persistCols();
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
        this._dividerEl.addEventListener('pointerdown', (e) => {
            // Only resize in the both layout (divider hidden otherwise).
            if (this.collapsed.left || this.collapsed.right) return;
            e.preventDefault();
            this._dividerEl.classList.add('is-dragging');
            this._shellEl.classList.add('is-resizing');
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
        });
        // Double-click resets to an even split.
        this._dividerEl.addEventListener('dblclick', () => {
            this._setCols(50);
            this._persistCols();
        });
        // Keyboard: arrows nudge the split 2% at a time.
        this._dividerEl.addEventListener('keydown', (e) => {
            if (this.collapsed.left || this.collapsed.right) return;
            const cur = this._currentPct();
            if (e.key === 'ArrowLeft')  { this._setCols(Math.max(this._MINPCT, cur - 2)); this._persistCols(); e.preventDefault(); }
            if (e.key === 'ArrowRight') { this._setCols(Math.min(this._MAXPCT, cur + 2)); this._persistCols(); e.preventDefault(); }
        });
    }

    // Drag past a bound collapses that pane (persists, like the buttons).
    toggleViaDrag(side) {
        if (!this.collapsed[side]) { this.collapse(side); this._persist(); }
    }

    _currentPct() {
        const v = getComputedStyle(this._shellEl).getPropertyValue('--shell-cols').trim();
        const n = parseFloat(v);
        return Number.isFinite(n) ? n : 50;
    }

    _setCols(pct) {
        const left = Math.min(this._MAXPCT, Math.max(this._MINPCT, pct));
        this._shellEl.style.setProperty('--shell-cols', left + '%');
        this._shellEl.style.setProperty('--shell-cols-r', (100 - left) + '%');
    }

    _endDrag() {
        this._dividerEl?.classList.remove('is-dragging');
        this._shellEl?.classList.remove('is-resizing');
    }

    _persistCols() {
        if (!this._colsKey) return;
        sessionStorage.setItem(this._colsKey, String(this._currentPct()));
    }

    _restoreCols() {
        if (!this._colsKey) return;
        const saved = sessionStorage.getItem(this._colsKey);
        if (saved == null) return;
        const n = parseFloat(saved);
        if (Number.isFinite(n)) this._setCols(n);
    }
}
