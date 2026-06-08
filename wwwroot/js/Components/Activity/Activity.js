// =====================  Activity.js  ===================== //
// Renders the ticket activity as a single chronological timeline.
//
// Backend: TicketDetails/GetActivity -> HistoryManager.GetHistory returns a flat
// list of HistoryListItem -> { historyTxt, name, historyDate }. There is no
// per-event type, so there is no type-based filtering: every entry is shown in
// sequence, newest first.

'use strict';

const Activity = (() => {

    // -------------------------  DOM refs  ------------------------- //

    const Dom = {
        list: () => document.getElementById('Activity-List'),
    };

    // -------------------------  State  ------------------------- //

    const State = {
        ticketId: null,
        items: [],
    };

    // -------------------------  Helpers  ------------------------- //

    const Helpers = {

        formatDateTime(raw) {
            if (!raw) return '';
            const d = new Date(raw);
            if (isNaN(d)) return '';
            return d.toLocaleDateString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
            });
        },

        timeAgo(raw) {
            if (!raw) return '';
            const d = new Date(raw);
            if (isNaN(d)) return '';
            const diff = Math.round((Date.now() - d) / 1000);
            if (diff < 60) return 'just now';
            if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
            if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
            if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
            return Helpers.formatDateTime(raw);
        },
    };

    // -------------------------  Init  ------------------------- //

    function init(ticketId) {
        State.ticketId = parseInt(ticketId, 10);
        _getActivity();
    }

    // -------------------------  Fetch  ------------------------- //

    async function _getActivity() {
        const list = Dom.list();
        if (!list) return;

        try {
            const data = await API.post(
                'TicketDetails/GetActivity',
                API.authPayload({ ticketId: State.ticketId })
            );

            State.items = Array.isArray(data) ? data.slice() : [];
            State.items.sort(
                (a, b) => new Date(b.historyDate) - new Date(a.historyDate)
            );

            _render();

        } catch (err) {
            console.error('Activity._getActivity:', err);
            _renderMessage('Failed to load activity.');
        }
    }

    // -------------------------  Render  ------------------------- //

    function _render() {
        const list = Dom.list();
        if (!list) return;

        list.innerHTML = '';

        if (State.items.length === 0) {
            _renderMessage('No activity to show.');
            return;
        }

        const fragment = document.createDocumentFragment();
        State.items.forEach(item => fragment.appendChild(_buildItem(item)));
        list.appendChild(fragment);
    }

    function _renderMessage(msg) {
        const list = Dom.list();
        if (!list) return;
        list.innerHTML = '';
        const li = document.createElement('li');
        li.className = 'td-thread-empty';
        li.textContent = msg;
        list.appendChild(li);
    }

    function _buildItem(item) {
        const li = document.createElement('li');
        li.className = 'td-timeline-item';

        const head = document.createElement('div');
        head.className = 'td-tl-head';

        const actor = document.createElement('span');
        actor.className = 'td-tl-actor';
        actor.textContent = item.name || 'System';
        head.appendChild(actor);

        const time = document.createElement('time');
        time.className = 'td-tl-time';
        time.dateTime = item.historyDate || '';
        time.textContent = Helpers.timeAgo(item.historyDate);
        time.title = Helpers.formatDateTime(item.historyDate);
        head.appendChild(time);

        li.appendChild(head);

        const body = document.createElement('div');
        body.className = 'td-tl-body';
        body.textContent = item.historyTxt || '';
        li.appendChild(body);

        return li;
    }

    // -------------------------  Public API  ------------------------- //

    return {
        init,
        refresh: _getActivity,
    };

})();

if (typeof window !== 'undefined') {
    window.Activity = Activity;
}
