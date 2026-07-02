// =====================  TicketDrawer.js  ===================== //
// Slide-in workspace drawer + right-edge rail for the ticket page.
// The four workspace tabpanels live inside #ws-drawer; the tab BUTTONS live
// in the #ws-rail edge rail (same ids/roles as before, so Tabs/TicketShell,
// pips, clientView hiding, and NotesLeft all keep working untouched).
// Contextual save bar: shown while State.isDirty (fed by Dirty.set in
// TicketSave.js); Save shares Save.execute, Discard restores the dirty
// baseline. Closing is always non-destructive -- dirty state survives and
// the topbar Save stays lit. Loaded as a global; binds on DOMContentLoaded.

'use strict';

const TicketDrawer = {

    _open: false,

    _els() {
        return {
            drawer: document.getElementById('ws-drawer'),
            scrim: document.getElementById('drawer-scrim'),
            title: document.getElementById('drawer-title'),
            saveBar: document.getElementById('drawer-savebar'),
            saveBtn: document.getElementById('drawer-save-btn'),
        };
    },

    isOpen() { return TicketDrawer._open; },

    _label(name) {
        return name ? name.charAt(0).toUpperCase() + name.slice(1) : '';
    },

    setTitle(name) {
        const { title } = TicketDrawer._els();
        if (title && name) title.textContent = TicketDrawer._label(name);
    },

    open(name) {
        const { drawer, scrim } = TicketDrawer._els();
        if (!drawer) return;
        TicketDrawer.setTitle(name || State.activeTab);
        TicketDrawer.syncDirty(State.isDirty);
        drawer.classList.add('is-open');
        scrim?.classList.add('is-open');
        if (!TicketDrawer._open) {
            TicketDrawer._open = true;
            // Land keyboard users where the content is.
            document.getElementById('drawer-close')?.focus();
        }
    },

    close() {
        const { drawer, scrim } = TicketDrawer._els();
        if (!drawer || !TicketDrawer._open) return;
        TicketDrawer._open = false;
        drawer.classList.remove('is-open');
        scrim?.classList.remove('is-open');
        // Hand focus back to the active section's rail icon.
        document.getElementById(`tab-${State.activeTab}`)?.focus?.();
    },

    // Called by Dirty.set (TicketSave.js) on every dirty-state change: the
    // save bar's presence IS the "unsaved changes" signal.
    syncDirty(isDirty) {
        const { saveBar, saveBtn } = TicketDrawer._els();
        if (!saveBar) return;
        if (isDirty) saveBar.removeAttribute('hidden');
        else saveBar.setAttribute('hidden', '');
        if (saveBtn) saveBtn.disabled = !isDirty;
    },

    _onKeydown(e) {
        if (e.key !== 'Escape' || !TicketDrawer._open) return;
        // The task overlay (z-index above the drawer) owns Escape while open.
        const taskOverlay = document.getElementById('task-overlay');
        if (taskOverlay && !taskOverlay.hidden) return;
        TicketDrawer.close();
    },

    bind() {
        document.getElementById('drawer-scrim')
            ?.addEventListener('click', TicketDrawer.close);
        document.getElementById('drawer-close')
            ?.addEventListener('click', TicketDrawer.close);
        document.getElementById('drawer-save-btn')
            ?.addEventListener('click', () => Save.execute());
        document.getElementById('drawer-discard-btn')
            ?.addEventListener('click', () => Dirty.restoreBaseline());
        document.addEventListener('keydown', TicketDrawer._onKeydown);
    },
};

// Explicit window attachment: top-level const does not create a window
// property, and cross-file consumers guard via window.TicketDrawer?.
window.TicketDrawer = TicketDrawer;

document.addEventListener('DOMContentLoaded', TicketDrawer.bind);
