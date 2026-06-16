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

    // -------------------------  Inline edit  ------------------------- //

    function _beginMessageEdit(msg) {
        const row = document.querySelector('[data-mid="' + msg.MessageID + '"]');
        if (!row || row.querySelector('.td-bubble-editing')) return;
        const bubble = row.querySelector('.td-bubble');
        const body = bubble?.querySelector('.td-bubble-body');
        if (!bubble) return;
        const original = msg.Body ?? '';

        const wrap = document.createElement('div');
        wrap.className = 'td-bubble-editing';
        const ta = document.createElement('textarea');
        ta.className = 'td-bubble-edit-input';
        ta.value = original;
        ta.rows = Math.min(8, Math.max(1, original.split('\n').length));
        const bar = document.createElement('div');
        bar.className = 'td-bubble-edit-actions';
        const save = document.createElement('button');
        save.type = 'button'; save.className = 'td-bubble-edit-save'; save.textContent = 'Save';
        const cancel = document.createElement('button');
        cancel.type = 'button'; cancel.className = 'td-bubble-edit-cancel'; cancel.textContent = 'Cancel';
        bar.appendChild(save); bar.appendChild(cancel);
        wrap.appendChild(ta); wrap.appendChild(bar);
        if (body) body.style.display = 'none';
        bubble.insertBefore(wrap, bubble.firstChild);
        ta.focus();

        const restore = () => {
            wrap.remove();
            if (body) body.style.display = '';
        };
        cancel.addEventListener('click', restore);
        save.addEventListener('click', async () => {
            const text = ta.value.trim();
            if (!text || text === original) { restore(); return; }
            save.disabled = cancel.disabled = true;
            const ok = await _submitMessageEdit(msg, text);
            if (!ok) { save.disabled = cancel.disabled = false; }
        });
    }

    async function _submitMessageEdit(msg, text) {
        try {
            const objectInfo = [
                `TicketID\`${State.ticketId}`,
                `NoteID\`${msg.MessageID}`,
                `noteDescription\`${text}`,
                'visibleToClient`1',
            ].join('|');
            const attachments = (msg.Attachments ?? [])
                .filter(a => a && a.base64)
                .map(a => ({
                    AttachmentName: a.name,
                    AttachmentByteArray: a.base64,
                    AttachmentImageType: 0,
                }));
            const data = await API.post(
                'TicketDetails/SaveNote',
                API.authPayload({ objectInfo, attachments, rfc: false })
            );
            if (!data) throw new Error('SaveNote returned null');
            UI.toast?.('Message updated', 'success');
            await load();
            return true;
        } catch (err) {
            console.error('MessagesPanel._submitMessageEdit:', err);
            UI.toast?.('Failed to update message', 'error');
            return false;
        }
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

        // Sender line + colour-hashed avatar on EVERY message (outbound too)
        // so individual senders are recognisable at a glance.
        if (msg.SenderName) {
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
        // Sender-only: edit your own message inline. Saved messages only
        // (MessageID present); optimistic bubbles have no id yet.
        if (msg.MessageID != null && _isOutbound(msg)) {
            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'td-bubble-edit';
            editBtn.setAttribute('aria-label', 'Edit message');
            editBtn.title = 'Edit';
            editBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" '
                + 'fill="none" stroke="currentColor" stroke-width="2" '
                + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
                + '<path d="M12 20h9"/>'
                + '<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
            editBtn.addEventListener('click', () => _beginMessageEdit(msg));
            bubble.appendChild(editBtn);
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
                <span class="td-file-icon" aria-hidden="true">${Format.fileIcon(att.name)}</span>
                <span class="td-file-name">${Format.escapeHtml(att.name)}</span>`;
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

            return true;

        } catch (err) {
            console.error('MessagesPanel._onSend:', err);
            State.messages = State.messages.filter(m => m.MessageID != null);
            _renderThread(State.messages);
            UI.toast?.('Failed to send message', 'error');
            return false;
        }
    }


    // -------------------------  Init  ------------------------- //

    function init(ticketId, adminLevel = 0) {
        State.ticketId = parseInt(ticketId, 10);
        if (!State.ticketId) return;

        _initScopeReminder(adminLevel);

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

    // Dismissible scope reminder -- Govtech users only (adminLevel >= 1);
    // authority users never see it. Session-only dismissal.
    const SCOPE_DISMISS_KEY = 'td-msg-scope-dismissed';

    function _initScopeReminder(adminLevel) {
        const banner = document.getElementById('msg-scope-banner');
        if (!banner) return;
        if (Number(adminLevel) < 1 || sessionStorage.getItem(SCOPE_DISMISS_KEY) === '1') {
            banner.remove();
            return;
        }
        banner.removeAttribute('hidden');
        document.getElementById('msg-scope-dismiss')?.addEventListener('click', () => {
            sessionStorage.setItem(SCOPE_DISMISS_KEY, '1');
            banner.remove();
        });
    }

    return {
        init,
        refresh: load,
    };

})();
