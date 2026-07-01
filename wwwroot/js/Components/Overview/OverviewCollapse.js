// OverviewCollapse.js -- shared collapse/expand core for a detail page's
// Overview band. No ES modules: exposes window.createOverviewCollapse and is
// consumed by OverviewPanel.js (ticket) and RFCOverview.js (RFC), each of
// which supplies its band element ID and its own slim-summary field map.
(function () {
    'use strict';

    function txt(id) {
        var el = document.getElementById(id);
        return el ? (el.textContent || '').trim() : '';
    }

    function selText(id) {
        var el = document.getElementById(id);
        if (!el || el.selectedIndex < 0) return '';
        var opt = el.options[el.selectedIndex];
        return opt ? (opt.textContent || '').trim() : '';
    }

    function create(opts) {
        var bandId = opts.bandId;
        var buildSlim = opts.buildSlim; // function(txt, selText) -> {slimElId: value}

        function fillSlim() {
            var map = buildSlim(txt, selText);
            Object.keys(map).forEach(function (id) {
                var el = document.getElementById(id);
                if (el) el.textContent = map[id];
            });
        }

        function setCollapsed(collapsed) {
            var band = document.getElementById(bandId);
            if (!band) return;
            if (collapsed) fillSlim();
            band.classList.toggle('is-collapsed', collapsed);

            var btn = document.getElementById('ov-collapse');
            if (btn) {
                btn.setAttribute('aria-expanded', String(!collapsed));
                btn.setAttribute('aria-label', collapsed ? 'Expand overview' : 'Collapse overview');
            }
            var slim = document.getElementById('ov-slim');
            if (slim) slim.setAttribute('aria-hidden', String(!collapsed));
        }

        function toggle() {
            var band = document.getElementById(bandId);
            if (!band) return;
            setCollapsed(!band.classList.contains('is-collapsed'));
        }

        function init() {
            var btn = document.getElementById('ov-collapse');
            if (btn && !btn._ovBound) {
                btn._ovBound = true;
                btn.addEventListener('click', toggle);
            }
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }

        return { init: init, toggle: toggle, setCollapsed: setCollapsed };
    }

    window.createOverviewCollapse = create;
})();
