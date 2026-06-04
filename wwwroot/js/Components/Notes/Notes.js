// =====================  Notes.js  ===================== //
//
// The Notes tab on the ticket detail page: INTERNAL notes only (notes that
// are visible to the client are "messages" and live in the Messages pane).
//
// Shared concerns are delegated: display helpers -> Format.js, and the
// composer (input, char-count, attachments) -> Composer.js. This file owns
// the data layer (load/normalise/filter/save) and the note-card rendering.

'use strict';

const Notes = (() => {

    // -------------------------  Constants / State  ------------------------- //

    const CHAR_LIMIT = 2000;

    const VISIBILITY = { INTERNAL: 'internal', CLIENT: 'client' };

    const State = {
        ticketId: null,
        notes: [],
        visibility: VISIBILITY.INTERNAL,
    };

    const Dom = {
        noteThread: () => document.getElementById('Notes-Thread'),
        visibilityBtn: () => document.getElementById('note-visibility-btn'),
        scopeNote: () => document.getElementById('note-scope-banner'),
    };

    const Session = {
        get userName() { return sessionStorage.getItem(STORAGE_KEYS.USER_NAME); },
    };

    let composer = null;

    // -------------------------  ObjectInfo builder  ------------------------- //
    // Builds the pipe-backtick string matching SaveNoteRequest.ObjectInfo:
    // "FieldA`valueA|FieldB`valueB"
    function _buildObjectInfo(fields) {
        return Object.entries(fields)
            .filter(([, v]) => v !== null && v !== undefined && v !== '')
            .map(([k, v]) => `${k}\`${v}`)
            .join('|');
    }

    // -------------------------  Init  ------------------------- //

    function init(ticketId) {
        State.ticketId = parseInt(ticketId, 10);

        _bindVisibilityBtn();
        _applyScopeBanner();

        // Notes tab is internal-only; client-visible notes are composed in the
        // Messages pane. Pin internal and hide the client/internal toggle.
        State.visibility = VISIBILITY.INTERNAL;
        Dom.visibilityBtn()?.setAttribute('hidden', '');
        Dom.scopeNote()?.setAttribute('hidden', '');

        composer = Composer.create({
            textarea: 'note-textarea',
            sendBtn: 'note-send-btn',
            charcount: 'note-charcount',
            fileInput: 'note-file-input',
            attachList: 'note-attachment-list',
            composerDock: 'Notes-Compose',
            charLimit: CHAR_LIMIT,
            enableAttachments: true,
            onSend: _onSend,
        });

        _getNotes();
    }

    // -------------------------  Send (onSend callback)  ------------------------- //

    async function _onSend({ text, files }) {
        const tempId = `temp-${Date.now()}`;
        _appendNote(_buildOptimisticNote(tempId, text, files));

        try {
            const objectInfo = _buildObjectInfo({
                TicketID: State.ticketId,
                noteDescription: text,
                visibleToClient: State.visibility === VISIBILITY.CLIENT ? '1' : '0',
            });

            const attachments = await Composer.encode(files);

            const data = await API.post(
                'TicketDetails/SaveNote',
                API.authPayload({ objectInfo, attachments, rfc: false })
            );

            if (!data) throw new Error('SaveNote returned null');

            if (Array.isArray(data)) {
                State.notes = data;
                _renderNotes(data);
            } else {
                _replaceOptimisticNote(tempId, data);
                State.notes.push(data);
            }
            _updatePip();

            // Reset visibility to internal after send
            State.visibility = VISIBILITY.INTERNAL;
            _applyVisibilityBtn();
            _updateScopeBanner();

            return true;

        } catch (err) {
            console.error('Notes._onSend:', err);
            _removeOptimisticNote(tempId);
            UI.toast?.('Failed to add note', 'error');
            return false;
        }
    }

    function _buildOptimisticNote(tempId, body, files) {
        return {
            NoteID: tempId,
            AuthorName: Session.userName ?? 'You',
            Body: body,
            CreatedDate: new Date().toISOString(),
            IsVisibleToClient: State.visibility === VISIBILITY.CLIENT,
            Attachments: (files ?? []).map(f => ({ FileName: f.name, FileSize: f.size, FileURL: null })),
            _optimistic: true,
        };
    }

    // -------------------------  Get notes  ------------------------- //

    async function _getNotes() {
        try {
            const data = await API.post(
                'TicketDetails/GetNotes',
                API.authPayload({ ticketId: State.ticketId })
            );
            if (!Array.isArray(data)) return;

            State.notes = data;
            _renderNotes(data);
            _updatePip();

        } catch (err) {
            console.error('Notes._getNotes:', err);
            UI.toast?.('Failed to load notes', 'error');
        }
    }

    // -------------------------  Normalise + filter  ------------------------- //
    // Server notes arrive camelCase (NoteStub); map to the card shape. Notes
    // visible to the client are "messages" and live in the Messages pane, so
    // they are filtered out of this (internal-only) tab.

    function _normNote(n) {
        if (n && n.noteID !== undefined) {
            return {
                NoteID: n.noteID,
                AuthorName: n.notesAddedBy,
                Body: n.noteDescription,
                CreatedDate: n.noteDate,
                IsVisibleToClient: n.visibleToClient === true,
                Attachments: n.attachments ?? [],
            };
        }
        return n; // already card-shaped (optimistic)
    }

    function _internalOnly(notes) {
        return (Array.isArray(notes) ? notes : [])
            .map(_normNote)
            .filter(n => !n.IsVisibleToClient);
    }

    // -------------------------  Render  ------------------------- //

    function _renderNotes(notes) {
        const thread = Dom.noteThread();
        if (!thread) return;

        thread.innerHTML = '';

        const internal = _internalOnly(notes);

        if (internal.length === 0) {
            thread.appendChild(_buildEmptyState());
            return;
        }

        const fragment = document.createDocumentFragment();
        internal.forEach(note => fragment.appendChild(_buildNoteCard(note)));
        thread.appendChild(fragment);

        _scrollToBottom(false);
    }

    function _appendNote(note) {
        const thread = Dom.noteThread();
        if (!thread) return;

        const n = _normNote(note);
        if (n.IsVisibleToClient) return; // client-visible notes appear in Messages

        const empty = thread.querySelector('.td-thread-empty');
        empty?.remove();

        thread.appendChild(_buildNoteCard(n));
        _scrollToBottom(true);
    }

    function _replaceOptimisticNote(tempId, savedNote) {
        const thread = Dom.noteThread();
        const tempCard = thread?.querySelector(`[data-nid="${tempId}"]`);
        if (!tempCard) return;
        tempCard.replaceWith(_buildNoteCard(_normNote(savedNote)));
    }

    function _removeOptimisticNote(tempId) {
        const thread = Dom.noteThread();
        thread?.querySelector(`[data-nid="${tempId}"]`)?.remove();
    }

    function _buildEmptyState() {
        const div = document.createElement('div');
        div.className = 'td-thread-empty';
        div.setAttribute('aria-label', 'No notes yet');
        div.innerHTML = `
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.5"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
            </svg>
            <p>No notes yet.<br>Add an internal note below.</p>
        `;
        return div;
    }

    function _scrollToBottom(smooth = true) {
        const thread = Dom.noteThread();
        if (!thread) return;
        thread.scrollTo({ top: thread.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
    }

    function _updatePip() {
        if (typeof Tabs !== 'undefined') {
            Tabs.setPip('notes', _internalOnly(State.notes).length);
        }
    }

    // -------------------------  Note card  ------------------------- //

    function _buildNoteCard(note) {
        const card = document.createElement('div');
        card.className = 'td-note-card';
        card.dataset.nid = note.NoteID;

        if (note.IsVisibleToClient) card.classList.add('is-visible-to-client');
        if (note._optimistic) card.classList.add('is-optimistic');

        card.appendChild(_buildNoteHead(note));
        card.appendChild(_buildNoteBody(note));

        if (Array.isArray(note.Attachments) && note.Attachments.length > 0) {
            card.appendChild(_buildNoteAttachments(note.Attachments));
        }

        return card;
    }

    function _buildNoteHead(note) {
        const head = document.createElement('div');
        head.className = 'td-note-head';

        const avatar = document.createElement('div');
        avatar.className = 'td-note-avatar';
        avatar.textContent = Format.initials(note.AuthorName);
        avatar.setAttribute('aria-hidden', 'true');
        head.appendChild(avatar);

        const author = document.createElement('span');
        author.className = 'td-note-author';
        author.textContent = Format.escapeHtml(note.AuthorName ?? 'Unknown');
        head.appendChild(author);

        if (note.IsVisibleToClient) {
            const badge = document.createElement('span');
            badge.className = 'td-note-visible-badge';
            badge.innerHTML = `
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2.5"
                     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                </svg>
                Visible to client
            `;
            head.appendChild(badge);
        }

        const time = document.createElement('span');
        time.className = 'td-note-time';
        time.textContent = Format.formatDateTime(note.CreatedDate);
        time.setAttribute('title', note.CreatedDate ?? '');
        head.appendChild(time);

        return head;
    }

    function _buildNoteBody(note) {
        const body = document.createElement('div');
        body.className = 'td-note-body';
        body.textContent = note.Body ?? '';
        return body;
    }

    function _buildNoteAttachments(attachments) {
        const wrap = document.createElement('div');
        wrap.className = 'td-note-attachments';

        attachments.forEach(att => {
            const link = document.createElement('a');
            link.className = 'td-note-file';
            link.href = att.FileURL ?? '#';
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.setAttribute('aria-label', `Download ${att.FileName}`);
            link.innerHTML = `
                <span aria-hidden="true">${Format.fileIcon(att.FileName)}</span>
                <span>${Format.escapeHtml(att.FileName)}</span>
                <span class="mono">${Format.fileSizeLabel(att.FileSize ?? 0)}</span>
            `;
            wrap.appendChild(link);
        });

        return wrap;
    }

    // -------------------------  Scope banner  ------------------------- //

    function _applyScopeBanner() {
        const banner = Dom.scopeNote();
        if (!banner) return;

        if (!Session.isAdmin) {
            banner.setAttribute('hidden', '');
            return;
        }

        banner.removeAttribute('hidden');
        _updateScopeBanner();
    }

    function _updateScopeBanner() {
        const banner = Dom.scopeNote();
        if (!banner) return;

        const isClient = State.visibility === VISIBILITY.CLIENT;
        banner.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                ${isClient
                ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
                : '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'}
            </svg>
            ${isClient
                ? 'This note <strong>will be visible</strong> to the client.'
                : 'This note is <strong>internal only</strong> — not visible to the client.'}
        `;
    }

    // -------------------------  Visibility toggle  ------------------------- //

    function _bindVisibilityBtn() {
        const btn = Dom.visibilityBtn();
        if (!btn) return;

        _applyVisibilityBtn();

        btn.addEventListener('click', () => {
            State.visibility = State.visibility === VISIBILITY.INTERNAL
                ? VISIBILITY.CLIENT
                : VISIBILITY.INTERNAL;

            _applyVisibilityBtn();
            _updateScopeBanner();
        });
    }

    function _applyVisibilityBtn() {
        const btn = Dom.visibilityBtn();
        if (!btn) return;

        const isClient = State.visibility === VISIBILITY.CLIENT;

        btn.setAttribute('aria-pressed', isClient ? 'true' : 'false');
        btn.setAttribute('title', isClient
            ? 'Visible to client — click to make internal'
            : 'Internal only — click to share with client'
        );

        btn.innerHTML = isClient
            ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2.2"
                    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
               </svg>`
            : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2.2"
                    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
               </svg>`;
    }

    // -------------------------  Public API  ------------------------- //

    return {
        init,
        refresh: _getNotes,
    };

})();
