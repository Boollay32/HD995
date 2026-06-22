// RFCPillEdit.js -- editable Status & Priority topbar pills for RFC details.
// Mirrors the ticket PillEdit pattern but is self-contained: clicking a pill
// opens a popover of options read from the matching hidden <select>; choosing
// one sets the select value and dispatches 'change' so the existing
// dirty-tracking + Save flow persists it. Plain pills (option text); no ticket
// Topbar dependency. Popover (.td-pill-pop) + pill chrome are already styled.
(function () {
    'use strict';

    var PAIRS = [
        { pill: 'meta-status',   select: 'rfcStatus' },
        { pill: 'meta-priority', select: 'priority'  }
    ];

    // Map an option's label to the colour class PaneShell.css provides
    // (status-open/pending/resolved/closed, priority-high/medium/low).
    // Derived from the label text so it tracks the real DB values.
    function _colourClass(kind, label) {
        var t = String(label || '').trim().toLowerCase();
        if (kind === 'meta-status') {
            if (t.indexOf('open') === 0 || t === 'new') return 'status-open';
            if (t.indexOf('progress') !== -1 || t === 'pending' || t === 'active') return 'status-pending';
            if (t.indexOf('resolv') !== -1 || t.indexOf('solv') !== -1 || t === 'complete') return 'status-resolved';
            if (t.indexOf('closed') !== -1 || t.indexOf('withdrawn') !== -1 || t.indexOf('reject') !== -1) return 'status-closed';
            return 'status-open';
        }
        if (t.indexOf('high') !== -1 || t.indexOf('urgent') !== -1) return 'priority-high';
        if (t.indexOf('low') !== -1) return 'priority-low';
        return 'priority-medium';
    }

    function _renderPill(pair) {
        var pill = document.getElementById(pair.pill);
        var sel = document.getElementById(pair.select);
        if (!pill || !sel) return;
        var opt = sel.options[sel.selectedIndex];
        var label = opt ? opt.textContent : '';
        var colour = _colourClass(pair.pill, label);
        var led = pair.pill === 'meta-status' ? '<span class="td-led" aria-hidden="true"></span>' : '';
        pill.className = 'td-meta-pill td-meta-pill--editable ' + colour;
        pill.innerHTML = led + _esc(label);
    }

    function _esc(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function _close() {
        var p = document.getElementById('td-pill-pop');
        if (p) p.remove();
        document.removeEventListener('keydown', _onKey, true);
        document.removeEventListener('click', _onOutside, true);
    }
    function _onKey(e) { if (e.key === 'Escape') _close(); }
    function _onOutside(e) {
        var p = document.getElementById('td-pill-pop');
        if (p && !p.contains(e.target)) _close();
    }

    function _open(pair) {
        if (document.getElementById('td-pill-pop')) { _close(); return; }  // toggle
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

        var host = document.getElementById('RFCDetails-App') || document.body;
        host.appendChild(pop);

        var r = pill.getBoundingClientRect();
        pop.style.top = (r.bottom + 6) + 'px';
        var left = r.left;
        var maxLeft = window.innerWidth - pop.offsetWidth - 8;
        if (left > maxLeft) left = Math.max(8, maxLeft);
        pop.style.left = left + 'px';

        setTimeout(function () {
            document.addEventListener('keydown', _onKey, true);
            document.addEventListener('click', _onOutside, true);
        }, 0);
    }

    function init() {
        PAIRS.forEach(function (pair) {
            var pill = document.getElementById(pair.pill);
            var sel = document.getElementById(pair.select);
            if (!pill || !sel) return;
            if (pill._pillBound) { _renderPill(pair); return; }  // re-render only

            pill._pillBound = true;
            pill.setAttribute('role', 'button');
            pill.setAttribute('tabindex', '0');
            pill.setAttribute('aria-haspopup', 'listbox');

            pill.addEventListener('click', function () { _open(pair); });
            pill.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _open(pair); }
            });
            sel.addEventListener('change', function () { _renderPill(pair); });

            _renderPill(pair);
        });
    }

    window.RFCPillEdit = { init: init };
})();
