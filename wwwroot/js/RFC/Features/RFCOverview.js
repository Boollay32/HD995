// RFCOverview.js -- collapse/expand for the RFC overview band (mirrors the
// ticket OverviewPanel). Thin config over the shared
// Components/Overview/OverviewCollapse.js core. Collapsing folds the body to
// a slim one-line summary built from the already-populated fields; the
// topbar (pills + Save + toggle) stays.
window.RFCOverview = createOverviewCollapse({
    bandId: 'RFC-Overview',
    buildSlim: function (txt, selText) {
        var dash = '\u2014';
        var target = document.getElementById('TargetDate');
        return {
            'ov-slim-originator': txt('changeRequestOriginator') || dash,
            'ov-slim-assigned': selText('assignedTechName') || dash,
            'ov-slim-target': (target && target.value) ? target.value : dash
        };
    }
});
