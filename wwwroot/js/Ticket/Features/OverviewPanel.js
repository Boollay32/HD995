// OverviewPanel.js — collapse/expand for the ticket Overview band.
// No ES modules: exposes window.OverviewPanel and self-binds on load.
// Collapsing folds the body to a slim one-line summary copied from the
// already-populated overview fields; the control strip (Save + toggle) stays.
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

    function fillSlim() {
        var dash = '\u2014';
        var target = document.getElementById('targetdate');
        var map = {
            'ov-slim-type': txt('requesttype') || dash,
            'ov-slim-from': txt('raisedby') || dash,
            'ov-slim-assigned': selText('assignedtech') || dash,
            'ov-slim-needed': (target && target.value) ? target.value : dash
        };
        Object.keys(map).forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.textContent = map[id];
        });
    }

    function setCollapsed(collapsed) {
        var band = document.getElementById('Ticket-Overview');
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
        var band = document.getElementById('Ticket-Overview');
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

    window.OverviewPanel = { init: init, toggle: toggle, setCollapsed: setCollapsed };
})();
