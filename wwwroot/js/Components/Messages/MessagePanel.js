// =====================  MessagesPanel.js  ===================== //
//
// Drives the LEFT "Messages" pane on the ticket detail page. A "message" is a
// client-visible note (visibleToClient = true); internal notes live in the
// Notes tab. Both read/write TicketDetails/GetNotes + SaveNote.
//
// Rendering is "Teams style": notes authored by the current user (notesUserID
// == Session.userId) sit on the right, everyone else on the left.
//
// Shared concerns delegated: display helpers -> Format.js, composer -> Composer.js.
// Attachments are loaded separately (GetNotes returns none) and merged by noteID.

'use strict';

const MessagesPanel = (() => {

    const CHAR_LIMIT = 2000;
    const MSG_DIRECTION = { OUT: 'out', IN: 'in' };

    const State = {
        ticketId: null,
        messages: [],   // normalised, client-visible only
    };

    const Dom = {
        thread: () => document.getElementById('Messages-Thread'),
    };

    const Session = {
        get userId() { return sessionStorage.getItem(STORAGE_KEYS.USER_ID); },
    };

    // -------------------------  Normalise  ------------------------- //

    function _normalise(note) {
        return {
            MessageID:   note.noteID,
            SenderID:    note.notesUserID,
            SenderName:  note.notesAddedBy,
            Body:        note.noteDescription,
            CreatedDate: note.noteDate,
            Attachments: (note.attachments ?? []).map(a => ({
                name: a.attachmentName,
                base64: a.attachmentByteArray,
            })),
        };
    }

    function _visibleNotes(notes) {
        return (Array.isArray(notes) ? notes : [])
            .filter(n => n && n.visibleToClient === true)
            .map(_normalise);
    }

    function _isOutbound(msg) {
        return String(msg.SenderID) === String(Session.userId);
    }

    // -------------------------  Load  ------------------------- //

    async function load() {
        try {
            const [data, attMap] = await Promise.all([
                API.post('TicketDetails/GetNotes', API.authPayload({ ticketId: State.ticketId })),
                Composer.fetchNoteAttachments(State.ticketId, 0),
            ]);
            (Array.isArray(data) ? data : []).forEach(n => {
                n.attachments = attMap.get(n.noteID) ?? n.attachments ?? [];
            });
            State.messages = _visibleNotes(data);
            _renderThread(State.messages);
            _scrollToBottom(false);
        } catch (err) {
            console.error('MessagesPanel.load:', err);
            UI.toast?.('Failed to load messages', 'error');
        }
    }

    // -------------------------  Render  ------------------------- //

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
            const key = Format.dateKey(msg.CreatedDate);
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
        const label = Format.formatDateLabel(raw);
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

    function _buildBubbleRow(msg) {
        const outbound = _isOutbound(msg);
        const direction = outbound ? MSG_DIRECTION.OUT : MSG_DIRECTION.IN;

        const row = document.createElement('div');
        row.className = `td-bubble-row td-bubble-row--${direction}`;
        if (msg.MessageID != null) row.dataset.mid = msg.MessageID;

        if (!outbound && msg.SenderName) {
            const sender = document.createElement('span');
            sender.className = 'td-bubble-sender';
            sender.appendChild(UI.avatarEl(msg.SenderName));
            sender.appendChild(document.createTextNode(msg.SenderName));
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
        if (Array.isArray(msg.Attachments) && msg.Attachments.length > 0) {
            bubble.appendChild(_buildBubbleAttachments(msg.Attachments));
        }
        return bubble;
    }

    function _buildBubbleAttachments(attachments) {
        const wrap = document.createElement('div');
        wrap.className = 'td-bubble-attachments';
        attachments.forEach(att => {
            const downloadable = !!att.base64;
            const el = document.createElement(downloadable ? 'a' : 'span');
            el.className = 'td-bubble-file';
            if (downloadable) {
                el.href = '#';
                el.setAttribute('aria-label', `Download ${att.name}`);
                el.addEventListener('click', (e) => {
                    e.preventDefault();
                    Composer.download(att.name, att.base64);
                });
            }
            el.innerHTML = `
                <span aria-hidden="true">${Format.fileIcon(att.name)}</span>
                <span>${Format.escapeHtml(att.name)}</span>`;
            wrap.appendChild(el);
        });
        return wrap;
    }

    function _buildBubbleMeta(msg) {
        const meta = document.createElement('div');
        meta.className = 'td-bubble-meta';
        const time = document.createElement('span');
        time.className = 'td-bubble-time';
        time.textContent = Format.formatTime(msg.CreatedDate);
        meta.appendChild(time);
        return meta;
    }

    function _scrollToBottom(smooth = true) {
        const thread = Dom.thread();
        if (!thread) return;
        thread.scrollTo({ top: thread.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
    }

    // -------------------------  Send (onSend callback)  ------------------------- //

    async function _onSend({ text, files }) {
        // Optimistic bubble (no id; reconciled by the authoritative reload)
        State.messages.push({
            MessageID: null,
            SenderID: Session.userId,
            SenderName: null,
            Body: text,
            CreatedDate: new Date().toISOString(),
            Attachments: (files ?? []).map(f => ({ name: f.name, base64: null })),
        });
        _renderThread(State.messages);
        _scrollToBottom(true);

        try {
            const objectInfo = [
                `TicketID\`${State.ticketId}`,
                `noteDescription\`${text}`,
                'visibleToClient`1',
            ].join('|');

            const attachments = await Composer.encode(files);

            const data = await API.post(
                'TicketDetails/SaveNote',
                API.authPayload({ objectInfo, attachments, rfc: false })
            );

            if (!data) throw new Error('SaveNote returned null');

            // Reload so the saved message's attachments (loaded separately) appear.
            await load();
            _scrollToBottom(true);

            // Notify the client that a visible update was posted.
            _notify();
            return true;

        } catch (err) {
            console.error('MessagesPanel._onSend:', err);
            State.messages = State.messages.filter(m => m.MessageID != null);
            _renderThread(State.messages);
            UI.toast?.('Failed to send message', 'error');
            return false;
        }
    }

    // -------------------------  Notify  ------------------------- //
    // A client-visible message is a "Responded" event on the ticket. Send the
    // notification mail directly (toast UI -- skip the modal that
    // SendNotificationEmail shows), mirroring TicketSave._notify. The recipient
    // logic (and the "no email for internal/Govtech authorities" case) lives in
    // BuildEmailAddressList. Fire-and-forget: a mail failure must not block the
    // send, and it has its own error handling.
    // NOTE: untestable from here -- verify against the live mail flow.
    async function _notify() {
        if (typeof BuildEmailAddressList !== 'function') return;
        try {
            const newTech = sessionStorage.getItem(STORAGE_KEYS.NEW_ASSIGNED_TECH);
            const username = sessionStorage.getItem(STORAGE_KEYS.USER_NAME);

            const address = await BuildEmailAddressList(
                'Responded', 'Ticket', newTech, username, getItemOwner()
            );
            if (!address) return;

            await SendMailMessage(
                address,
                CreateMessageSubject('Responded', 'Ticket', State.ticketId),
                BuildEmailBody('Responded', 'Ticket', State.ticketId)
            );
        } catch (err) {
            console.error('MessagesPanel._notify:', err);
        }
    }

    // -------------------------  Init  ------------------------- //

    function init(ticketId) {
        State.ticketId = parseInt(ticketId, 10);
        if (!State.ticketId) return;

        Composer.create({
            textarea: 'msg-textarea',
            sendBtn: 'msg-send-btn',
            charcount: 'msg-charcount',
            fileInput: 'msg-file-input',
            attachList: 'msg-attachment-list',
            composerDock: 'Messages-Compose',
            attachBtn: '#Messages-Compose .td-attach-btn',
            charLimit: CHAR_LIMIT,
            enableAttachments: true,
            onSend: _onSend,
        });

        load();
    }

    return {
        init,
        refresh: load,
    };

})();
