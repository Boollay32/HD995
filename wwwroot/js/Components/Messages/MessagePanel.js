// =====================  MessagesPanel.js  ===================== //
//
// Drives the LEFT "Messages" pane on the ticket detail page.
//
// A "message" is simply a CLIENT-VISIBLE note (visibleToClient = true).
// Internal notes stay in the Notes tab (handled by Notes.js). Both read
// and write the same TicketDetails/GetNotes + TicketDetails/SaveNote
// endpoints; the visibleToClient flag is what routes a note to one place
// or the other.
//
// Rendering is "Teams style": notes authored by the current user appear on
// the right (outbound), everyone else's on the left (inbound) with the
// author's name. Authorship is decided by notesUserID vs the current
// user's id (Session.userId) -- SaveNote stamps notesUserID server-side.
//
// Core scope: text conversation only. Attachments on messages are a
// follow-up (the note-attachment download path needs its own fix), so the
// attach control is hidden here for now.

'use strict';

const MessagesPanel = (() => {

    // -------------------------  Constants  ------------------------- //

    const CHAR_LIMIT = 2000;

    const MSG_DIRECTION = { OUT: 'out', IN: 'in' };

    // -------------------------  State  ------------------------- //

    const State = {
        ticketId: null,
        messages: [],   // normalised, client-visible only
        isLoading: false,
        isSending: false,
    };

    // -------------------------  DOM refs  ------------------------- //

    const Dom = {
        thread:       () => document.getElementById('Messages-Thread'),
        textarea:     () => document.getElementById('msg-textarea'),
        sendBtn:      () => document.getElementById('msg-send-btn'),
        charcount:    () => document.getElementById('msg-charcount'),
        composerDock: () => document.getElementById('Messages-Compose'),
        attachBtn:    () => document.querySelector('#Messages-Compose .td-attach-btn'),
    };

    // -------------------------  Session  ------------------------- //

    const Session = {
        get userId() { return sessionStorage.getItem(STORAGE_KEYS.USER_ID); },
    };

    // -------------------------  Helpers  ------------------------- //

    const Helpers = {
        formatTime(raw) {
            if (!raw) return '';
            const d = new Date(raw);
            if (isNaN(d)) return '';
            return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        },

        formatDateLabel(raw) {
            if (!raw) return '';
            const d = new Date(raw);
            if (isNaN(d)) return '';
            const today = new Date();
            const yest = new Date();
            yest.setDate(today.getDate() - 1);
            const sameDay = (a, b) =>
                a.getFullYear() === b.getFullYear() &&
                a.getMonth() === b.getMonth() &&
                a.getDate() === b.getDate();
            if (sameDay(d, today)) return 'Today';
            if (sameDay(d, yest)) return 'Yesterday';
            return d.toLocaleDateString('en-GB', {
                weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
            });
        },

        dateKey(raw) {
            const d = new Date(raw);
            if (isNaN(d)) return 'unknown';
            return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        },

        escapeHtml(str) {
            return String(str ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        },
    };

    // -------------------------  Normalise  ------------------------- //
    // Server sends camelCase NoteStub fields; map a client-visible note to
    // the bubble shape the renderer uses.

    function _normalise(note) {
        return {
            MessageID:   note.noteID,
            SenderID:    note.notesUserID,
            SenderName:  note.notesAddedBy,
            Body:        note.noteDescription,
            CreatedDate: note.noteDate,
        };
    }

    function _visibleNotes(notes) {
        return (Array.isArray(notes) ? notes : [])
            .filter(n => n && n.visibleToClient === true)
            .map(_normalise);
    }

    // -------------------------  Outbound check  ------------------------- //

    function _isOutbound(msg) {
        return String(msg.SenderID) === String(Session.userId);
    }

    // -------------------------  Load  ------------------------- //

    async function load() {
        if (State.isLoading) return;
        State.isLoading = true;
        try {
            const data = await API.post(
                'TicketDetails/GetNotes',
                API.authPayload({ ticketId: State.ticketId })
            );
            State.messages = _visibleNotes(data);
            _renderThread(State.messages);
            _scrollToBottom(false);
        } catch (err) {
            console.error('MessagesPanel.load:', err);
            UI.toast?.('Failed to load messages', 'error');
        } finally {
            State.isLoading = false;
        }
    }

    // -------------------------  Render thread  ------------------------- //

    function _renderThread(messages) {
        const thread = Dom.thread();
        if (!thread) return;

        thread.innerHTML = '';

        if (messages.length === 0) {
            thread.appendChild(_buildEmptyState());
            return;
        }

        const fragment = document.createDocumentFragment();
        let lastKey = null;

        messages.forEach(msg => {
            const key = Helpers.dateKey(msg.CreatedDate);
            if (key !== lastKey) {
                fragment.appendChild(_buildDateDivider(msg.CreatedDate));
                lastKey = key;
            }
            fragment.appendChild(_buildBubbleRow(msg));
        });

        thread.appendChild(fragment);
    }

    function _buildDateDivider(raw) {
        const div = document.createElement('div');
        div.className = 'td-date-divider';
        div.setAttribute('role', 'separator');
        const label = Helpers.formatDateLabel(raw);
        div.setAttribute('aria-label', label);
        const span = document.createElement('span');
        span.textContent = label;
        div.appendChild(span);
        return div;
    }

    function _buildEmptyState() {
        const div = document.createElement('div');
        div.className = 'td-thread-empty';
        div.setAttribute('aria-label', 'No messages yet');
        div.innerHTML = `
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.5"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
            <p>No messages yet.<br>Start the conversation below.</p>`;
        return div;
    }

    // -------------------------  Bubble builders  ------------------------- //

    function _buildBubbleRow(msg) {
        const outbound = _isOutbound(msg);
        const direction = outbound ? MSG_DIRECTION.OUT : MSG_DIRECTION.IN;

        const row = document.createElement('div');
        row.className = `td-bubble-row td-bubble-row--${direction}`;
        if (msg.MessageID != null) row.dataset.mid = msg.MessageID;

        // Author name -- only on inbound (other people's messages)
        if (!outbound && msg.SenderName) {
            const sender = document.createElement('span');
            sender.className = 'td-bubble-sender';
            sender.textContent = msg.SenderName;
            row.appendChild(sender);
        }

        row.appendChild(_buildBubble(msg));
        row.appendChild(_buildBubbleMeta(msg));
        return row;
    }

    function _buildBubble(msg) {
        const bubble = document.createElement('div');
        bubble.className = 'td-bubble';
        if (msg.Body) {
            const body = document.createElement('p');
            body.className = 'td-bubble-body';
            body.textContent = msg.Body; // textContent -- no XSS risk
            bubble.appendChild(body);
        }
        return bubble;
    }

    function _buildBubbleMeta(msg) {
        const meta = document.createElement('div');
        meta.className = 'td-bubble-meta';
        const time = document.createElement('span');
        time.className = 'td-bubble-time';
        time.textContent = Helpers.formatTime(msg.CreatedDate);
        meta.appendChild(time);
        return meta;
    }

    // -------------------------  Scroll  ------------------------- //

    function _scrollToBottom(smooth = true) {
        const thread = Dom.thread();
        if (!thread) return;
        thread.scrollTo({ top: thread.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
    }

    // -------------------------  Composer  ------------------------- //

    function _bindComposer() {
        const textarea = Dom.textarea();
        const sendBtn = Dom.sendBtn();
        if (!textarea || !sendBtn) return;

        textarea.addEventListener('input', () => {
            const len = textarea.value.length;
            const cc = Dom.charcount();
            if (cc) {
                cc.textContent = `${len} / ${CHAR_LIMIT}`;
                cc.classList.toggle('is-near-limit', len >= CHAR_LIMIT * 0.85);
                cc.classList.toggle('is-at-limit', len >= CHAR_LIMIT);
            }
            sendBtn.disabled = textarea.value.trim().length === 0;
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        });

        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!sendBtn.disabled) sendBtn.click();
            }
        });

        sendBtn.addEventListener('click', _send);
    }

    function _clearComposer(textarea, sendBtn) {
        textarea.value = '';
        textarea.style.height = 'auto';
        sendBtn.disabled = true;
        const cc = Dom.charcount();
        if (cc) {
            cc.textContent = `0 / ${CHAR_LIMIT}`;
            cc.classList.remove('is-near-limit', 'is-at-limit');
        }
    }

    // -------------------------  Send  ------------------------- //

    async function _send() {
        if (State.isSending) return;

        const textarea = Dom.textarea();
        const sendBtn = Dom.sendBtn();
        if (!textarea || !sendBtn) return;

        const body = textarea.value.trim();
        if (!body) return;

        State.isSending = true;
        sendBtn.disabled = true;

        // Optimistic bubble (no id; reconciled by the authoritative re-render)
        State.messages.push({
            MessageID: null,
            SenderID: Session.userId,
            SenderName: null,
            Body: body,
            CreatedDate: new Date().toISOString(),
        });
        _renderThread(State.messages);
        _scrollToBottom(true);

        try {
            const objectInfo = [
                `TicketID\`${State.ticketId}`,
                `noteDescription\`${body}`,
                'visibleToClient`1',
            ].join('|');

            const data = await API.post(
                'TicketDetails/SaveNote',
                API.authPayload({ objectInfo, attachments: [], rfc: false })
            );

            if (!data) throw new Error('SaveNote returned null');

            // Re-render from the authoritative list (replaces the optimistic bubble)
            State.messages = _visibleNotes(data);
            _renderThread(State.messages);
            _scrollToBottom(true);

            _clearComposer(textarea, sendBtn);

        } catch (err) {
            console.error('MessagesPanel._send:', err);
            // Drop the optimistic bubble and restore the text for a retry
            State.messages = State.messages.filter(m => m.MessageID != null);
            _renderThread(State.messages);
            textarea.value = body;
            sendBtn.disabled = false;
            UI.toast?.('Failed to send message', 'error');
        } finally {
            State.isSending = false;
        }
    }

    // -------------------------  Init  ------------------------- //

    function init(ticketId) {
        State.ticketId = parseInt(ticketId, 10);
        if (!State.ticketId) return;

        // Attachments on messages are a follow-up -- hide the attach control.
        Dom.attachBtn()?.setAttribute('hidden', '');

        _bindComposer();
        load();
    }

    // -------------------------  Public API  ------------------------- //

    return {
        init,
        refresh: load,
    };

})();
