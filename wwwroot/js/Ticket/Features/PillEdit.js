// PillEdit.js -- makes the topbar Status & Priority pills interactive. Clicking
// a pill opens a small popover of options (read from the matching hidden
// <select>); choosing one sets the select's value and dispatches 'change', so
// the existing dirty-tracking + Save flow persists it. A 'change' listener
// re-renders the pill. Requires Topbar (TicketFields.js), loaded earlier.
(function () {
    'use strict';

    var PAIRS = [
        { pill: 'meta-status',   select: 'status',   led: true,  cls: 'statusClass',   lbl: 'statusLabel' },
        { pill: 'meta-priority', select: 'priority', led: false, cls: 'priorityClass', lbl: 'priorityLabel' }
    ];

    function _close() {
        var p = document.getElementById('td-pill-pop');
        if (p) p.remove();
        document.removeEventListener('keydown', _onKey, true);
        document.removeEventListener('click', _onOutside, true);
    }

    function _onKey(e) {
        if (e.key === 'Escape') _close();
    }

    function _onOutside(e) {
        var p = document.getElementById('td-pill-pop');
        if (p && !p.contains(e.target)) _close();
    }

    function _renderPill(pair) {
        if (typeof Topbar === 'undefined') return;
        var pill = document.getElementById(pair.pill);
        var sel = document.getElementById(pair.select);
        if (!pill || !sel) return;
        Topbar.renderPill(pill, Topbar[pair.cls](sel.value), Topbar[pair.lbl](sel.value), pair.led);
    }

    function _open(pair) {
        if (document.getElementById('td-pill-pop')) { _close(); return; } // toggle

        var pill = document.getElementById(pair.pill);
        var sel = document.getElementById(pair.select);
        if (!pill || !sel || sel.options.length === 0) return;

        var pop = document.createElement('div');
        pop.id = 'td-pill-pop';
        pop.className = 'td-pill-pop';
        pop.setAttribute('role', 'listbox');

        Array.prototype.forEach.call(sel.options, function (o) {
            if (!o.value) return;
            var item = document.createElement('button');
            item.type = 'button';
            item.className = 'td-pill-pop-item'
                + (String(o.value) === String(sel.value) ? ' is-current' : '');
            item.setAttribute('role', 'option');
            item.textContent = o.textContent;
            item.addEventListener('click', function () {
                if (String(sel.value) !== String(o.value)) {
                    sel.value = o.value;
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                }
                _close();
                pill.focus();
            });
            pop.appendChild(item);
        });

        var host = document.getElementById('TicketDetails-App') || document.body;
        host.appendChild(pop);

        var r = pill.getBoundingClientRect();
        pop.style.top = (r.bottom + 6) + 'px';
        var left = r.left;
        var maxLeft = window.innerWidth - pop.offsetWidth - 8;
        if (left > maxLeft) left = Math.max(8, maxLeft);
        pop.style.left = left + 'px';

        // Bind dismissal after the current click cycle so this open click
        // does not immediately close it.
        setTimeout(function () {
            document.addEventListener('keydown', _onKey, true);
            document.addEventListener('click', _onOutside, true);
        }, 0);
    }

    function init() {
        PAIRS.forEach(function (pair) {
            var pill = document.getElementById(pair.pill);
            var sel = document.getElementById(pair.select);
            if (!pill || !sel || pill._pillBound) return;

            pill._pillBound = true;
            pill.setAttribute('role', 'button');
            pill.setAttribute('tabindex', '0');
            pill.setAttribute('aria-haspopup', 'listbox');
            pill.classList.add('td-meta-pill--editable');

            pill.addEventListener('click', function () { _open(pair); });
            pill.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _open(pair); }
            });
            sel.addEventListener('change', function () { _renderPill(pair); });
        });
    }

    window.PillEdit = { init: init };
})();
