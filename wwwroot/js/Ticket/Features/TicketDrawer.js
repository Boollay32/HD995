// =====================  TicketDrawer.js  ===================== //
// Ticket-page config over Components/Shell/DetailDrawer.js (shared core).
// The four workspace tabpanels live inside #ws-drawer; the tab BUTTONS live
// in the #ws-rail edge rail (same ids/roles as before, so Tabs/TicketShell,
// pips, clientView hiding, and NotesLeft all keep working untouched).
// Contextual save bar: shown while State.isDirty (fed by Dirty.set in
// TicketSave.js); Save shares Save.execute, Discard restores the dirty
// baseline. Closing is always non-destructive -- dirty state survives and
// the overview-header Save stays lit.

'use strict';

window.TicketDrawer = createDetailDrawer({

    activeName: () => State.activeTab,
    isDirty: () => State.isDirty,

    onSave: () => Save.execute(),
    onDiscard: () => Dirty.restoreBaseline(),

    // The task overlay (z-index above the drawer) owns Escape while open.
    escGuard: () => {
        const overlay = document.getElementById('task-overlay');
        return !!(overlay && !overlay.hidden);
    },

    // Hand focus back to the active section's rail icon on close.
    closeFocusEl: () => document.getElementById(`tab-${State.activeTab}`),
});
