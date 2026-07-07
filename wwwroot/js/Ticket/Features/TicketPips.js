// =====================  TicketPips.js  ===================== //
//
// The Notes / Tasks tab pips: a small unread-count badge showing how many
// note/task notifications THIS user has for THIS ticket that they haven't
// seen. Per-user (the server keys everything on the caller's id); opening a
// tab marks that kind read and clears its pip. Notifications are only written
// for the people an update was routed to (assigned tech / creator), so the
// pip appears only for those who needed telling.

'use strict';

const TicketPips = (() => {

    function _set(id, count) {
        const el = document.getElementById(id);
        if (!el) return;
        if (count > 0) {
            el.textContent = count > 99 ? '99+' : String(count);
            el.classList.remove('hidden');
        } else {
            el.textContent = '';
            el.classList.add('hidden');
        }
    }

    // Fetch and paint both pips for a ticket.
    async function load(ticketId) {
        try {
            const data = await API.post('Notification/TicketPips',
                API.authPayload({ ticketId: parseInt(ticketId, 10) }));
            if (!data) return;
            _set('notes-pip', Number(data.noteUnread) || 0);
            _set('tasks-pip', Number(data.taskUnread) || 0);
        } catch (err) {
            console.error('TicketPips.load:', err);
        }
    }

    // Clear one pip's notifications server-side, then blank the pip. Called
    // when the matching tab is opened. kind = 'note' | 'task'.
    async function clear(ticketId, kind) {
        const pipId = kind === 'task' ? 'tasks-pip' : 'notes-pip';
        // Optimistic: blank immediately; the mark-read is best-effort.
        _set(pipId, 0);
        try {
            await API.post('Notification/MarkPipRead',
                API.authPayload({ ticketId: parseInt(ticketId, 10), kind }));
        } catch (err) {
            console.error('TicketPips.clear:', err);
        }
    }

    return { load, clear };

})();
