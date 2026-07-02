// =====================  DetailDrawer.js  ===================== //
// Shared slide-in workspace drawer core for the detail pages (Ticket, RFC).
// Pattern mirrors PersistedToggle: a shared factory plus thin per-page
// configs (Ticket/Features/TicketDrawer.js, RFC/Features/RFCDrawer.js),
// each supplying its own save / discard / dirty wiring.
//
// Expects the standard drawer markup ids on the page:
//   #ws-drawer #drawer-scrim #drawer-title #drawer-savebar
//   #drawer-save-btn #drawer-discard-btn #drawer-close
// Styling comes from Components/DetailDrawer.css.
//
// No ES modules: exposes window.createDetailDrawer.

'use strict';

function createDetailDrawer(opts) {
    opts = opts || {};

    let _open = false;

    function _els() {
        return {
            drawer: document.getElementById('ws-drawer'),
            scrim: document.getElementById('drawer-scrim'),
            title: document.getElementById('drawer-title'),
            saveBar: document.getElementById('drawer-savebar'),
            saveBtn: document.getElementById('drawer-save-btn'),
        };
    }

    function _label(name) {
        if (opts.label) return opts.label(name);
        return name ? name.charAt(0).toUpperCase() + name.slice(1) : '';
    }

    function isOpen() { return _open; }

    function setTitle(name) {
        const { title } = _els();
        if (title && name) title.textContent = _label(name);
    }

    function open(name) {
        const { drawer, scrim } = _els();
        if (!drawer) return;
        setTitle(name || opts.activeName?.());
        syncDirty(!!opts.isDirty?.());
        drawer.classList.add('is-open');
        scrim?.classList.add('is-open');
        if (!_open) {
            _open = true;
            // Land keyboard users where the content is.
            document.getElementById('drawer-close')?.focus();
        }
    }

    function close() {
        const { drawer, scrim } = _els();
        if (!drawer || !_open) return;
        _open = false;
        drawer.classList.remove('is-open');
        scrim?.classList.remove('is-open');
        // Hand focus back to the page (usually the active rail icon).
        opts.closeFocusEl?.()?.focus?.();
    }

    // Called by the page's dirty tracking on every state change: the save
    // bar's presence IS the "unsaved changes" signal.
    function syncDirty(isDirty) {
        const { saveBar, saveBtn } = _els();
        if (!saveBar) return;
        if (isDirty) saveBar.removeAttribute('hidden');
        else saveBar.setAttribute('hidden', '');
        if (saveBtn) saveBtn.disabled = !isDirty;
    }

    function _onKeydown(e) {
        if (e.key !== 'Escape' || !_open) return;
        // A page overlay stacked above the drawer owns Escape while open.
        if (opts.escGuard?.()) return;
        close();
    }

    function _bind() {
        document.getElementById('drawer-scrim')
            ?.addEventListener('click', close);
        document.getElementById('drawer-close')
            ?.addEventListener('click', close);
        document.getElementById('drawer-save-btn')
            ?.addEventListener('click', () => opts.onSave?.());
        document.getElementById('drawer-discard-btn')
            ?.addEventListener('click', () => opts.onDiscard?.());
        document.addEventListener('keydown', _onKeydown);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _bind);
    } else {
        _bind();
    }

    return { open, close, isOpen, setTitle, syncDirty };
}

// Explicit window attachment: top-level declarations don't create window
// properties, and page configs reference this by window-qualified guard.
window.createDetailDrawer = createDetailDrawer;
