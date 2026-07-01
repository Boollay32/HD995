// OverviewPanel.js -- collapse/expand for the ticket Overview band.
// Thin config over the shared Components/Overview/OverviewCollapse.js core.
// Collapsing folds the body to a slim one-line summary copied from the
// already-populated overview fields; the control strip (Save + toggle) stays.
window.OverviewPanel = createOverviewCollapse({
    bandId: 'Ticket-Overview',
    buildSlim: function (txt, selText) {
        var dash = '\u2014';
        var target = document.getElementById('targetdate');
        // Client tickets swap this node for a read-only "Last updated" label
        // (TicketFields.js) -- follow whichever one is actually visible.
        var lastUpdated = document.getElementById('ov-last-updated');
        var neededVal = (lastUpdated && !lastUpdated.hidden)
            ? (lastUpdated.textContent || dash)
            : ((target && target.value) ? target.value : dash);
        return {
            'ov-slim-type': txt('requesttype') || dash,
            'ov-slim-from': txt('raisedby') || dash,
            'ov-slim-assigned': selText('assignedtech') || dash,
            'ov-slim-needed': neededVal
        };
    }
});
