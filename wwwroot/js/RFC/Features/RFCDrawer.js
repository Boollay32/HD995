// =====================  RFCDrawer.js  ===================== //
// RFC-page config over Components/Shell/DetailDrawer.js (shared core).
// Single "Details" section: the rail's one icon toggles the drawer holding
// the Extended Information form (RFC has no tab-switching machinery).
// Dirty state is fed by RFCDetails.js's delegated refresh; Save shares
// rfcSave.saveRFC, Discard restores the captured dirty baseline
// (RFCDetails._rfcDirtyDiscard). Closing is always non-destructive --
// dirty state survives and the overview-header Save stays lit.

'use strict';

window.RFCDrawer = createDetailDrawer({

    activeName: () => 'details',

    // Dirty proxy: RFCDetails' delegated refresh drives #Save-Button's
    // disabled state directly (there is no central Dirty object here).
    isDirty: () => {
        const btn = document.getElementById('Save-Button');
        return !!(btn && !btn.disabled);
    },

    onSave: () => {
        if (typeof rfcSave !== 'undefined') rfcSave.saveRFC();
    },
    onDiscard: () => window.rfcManager?._rfcDirtyDiscard?.(),

    // Hand focus back to the rail's Details icon on close.
    closeFocusEl: () => document.getElementById('rfc-tab-details'),
});

// Rail wiring: the single Details icon toggles the drawer.
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('rfc-tab-details')?.addEventListener('click', () => {
        if (window.RFCDrawer.isOpen()) window.RFCDrawer.close();
        else window.RFCDrawer.open('details');
    });
});
