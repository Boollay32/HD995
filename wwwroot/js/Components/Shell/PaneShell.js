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
}
