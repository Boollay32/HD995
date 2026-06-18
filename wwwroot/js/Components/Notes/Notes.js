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
        scopeDismiss: () => document.getElementById('note-scope-dismiss'),
    };

    const Session = {
        get userName() { return sessionStorage.getItem(STORAGE_KEYS.USER_NAME); },
        get userID() {
            const v = sessionStorage.getItem(STORAGE_KEYS.USER_ID);
            return v == null || v === '' ? null : Number(v);
        },
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
        _initScopeReminder();

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

            // Re-fetch so the saved note's attachments (loaded separately) appear.
            await _getNotes();

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
            Attachments: (files ?? []).map(f => ({ name: f.name, size: f.size, base64: null })),
            _optimistic: true,
        };
    }

    // -------------------------  Inline edit  ------------------------- //

    // Swap a note card's body for an editable textarea with Save/Cancel.
    function _beginNoteEdit(note) {
        const card = Dom.noteThread()?.querySelector('[data-nid="' + note.NoteID + '"]');
        if (!card || card.querySelector('.td-note-editor')) return;
        const body = card.querySelector('.td-note-body');
        if (!body) return;
        const original = note.Body ?? '';

        // Edit mode lets the creator remove existing attachments (gated by
        // .is-editing) and stage new ones below until Save.
        card.classList.add('is-editing');
        let pending = [];

        const wrap = document.createElement('div');
        wrap.className = 'td-note-editor';
        const ta = document.createElement('textarea');
        ta.className = 'td-note-edit-input';
        ta.value = original;
        ta.rows = Math.min(8, Math.max(2, original.split('\n').length));

        const pendingWrap = document.createElement('div');
        pendingWrap.className = 'td-note-edit-attachments';
        const renderPending = () => {
            pendingWrap.innerHTML = '';
            pending.forEach((file, index) => {
                const chip = document.createElement('div');
                chip.className = 'td-attach-chip';
                chip.dataset.index = index;
                chip.innerHTML = `
                    <span aria-hidden="true">${Format.fileIcon(file.name)}</span>
                    <span class="td-chip-name">${Format.escapeHtml(file.name)}</span>
                    <span class="td-chip-size mono">${Format.fileSizeLabel(file.size)}</span>
                    <button type="button" aria-label="Remove ${Format.escapeHtml(file.name)}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" stroke-width="2.5"
                             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>`;
                chip.querySelector('button')?.addEventListener('click', () => {
                    pending.splice(index, 1);
                    renderPending();
                });
                pendingWrap.appendChild(chip);
            });
        };

        const bar = document.createElement('div');
        bar.className = 'td-note-edit-actions';

        const addLabel = document.createElement('label');
        addLabel.className = 'td-note-edit-attach td-attach-btn';
        addLabel.setAttribute('aria-label', 'Add attachment to note');
        addLabel.title = 'Add attachment';
        const addInput = document.createElement('input');
        addInput.type = 'file';
        addInput.className = 'sr-only';
        addInput.multiple = true;
        addInput.accept = '*/*';
        addInput.addEventListener('change', () => {
            if (addInput.files && addInput.files.length) {
                pending = pending.concat(Array.from(addInput.files));
                renderPending();
            }
            addInput.value = '';
        });
        addLabel.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" '
            + 'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" '
            + 'stroke-linejoin="round" aria-hidden="true">'
            + '<path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66L9.41 17.41a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>';
        addLabel.appendChild(addInput);

        const save = document.createElement('button');
        save.type = 'button'; save.className = 'td-note-edit-save'; save.textContent = 'Save';
        const cancel = document.createElement('button');
        cancel.type = 'button'; cancel.className = 'td-note-edit-cancel'; cancel.textContent = 'Cancel';
        bar.appendChild(addLabel); bar.appendChild(save); bar.appendChild(cancel);
        wrap.appendChild(ta); wrap.appendChild(pendingWrap); wrap.appendChild(bar);
        body.replaceWith(wrap);
        ta.focus();

        const restore = () => {
            card.classList.remove('is-editing');
            const fresh = _buildNoteBody({ Body: original });
            wrap.replaceWith(fresh);
        };
        cancel.addEventListener('click', restore);
        save.addEventListener('click', async () => {
            const text = ta.value.trim();
            if (!text || (text === original && pending.length === 0)) { restore(); return; }
            save.disabled = cancel.disabled = true;
            const ok = await _submitNoteEdit(note, text, pending);
            if (!ok) { save.disabled = cancel.disabled = false; }
        });
    }

    // Re-submit an existing note with new text. The proc updates in place
    // when NoteID is present; it also wipes + re-inserts attachments, so we
    // re-send the note's existing attachments to preserve them.
    async function _submitNoteEdit(note, text, addedFiles = []) {
        try {
            const objectInfo = _buildObjectInfo({
                TicketID: State.ticketId,
                NoteID: note.NoteID,
                noteDescription: text,
                visibleToClient: note.IsVisibleToClient ? '1' : '0',
            });
            const existing = (note.Attachments ?? [])
                .filter(a => a && a.base64)
                .map(a => ({
                    AttachmentName: a.name,
                    AttachmentByteArray: a.base64,
                    AttachmentImageType: 0,
                }));
            const added = await Composer.encode(addedFiles);
            const attachments = existing.concat(added);
            const data = await API.post(
                'TicketDetails/SaveNote',
                API.authPayload({ objectInfo, attachments, rfc: false })
            );
            if (!data) throw new Error('SaveNote returned null');
            UI.toast?.('Note updated', 'success');
            await _getNotes();
            return true;
        } catch (err) {
            console.error('Notes._submitNoteEdit:', err);
            UI.toast?.('Failed to update note', 'error');
            return false;
        }
    }

    // Remove a single attachment from a saved note by re-saving the note with
    // that attachment filtered out (body unchanged). The remaining attachments
    // shift down automatically. Creator-only (gated where the button is added).
    async function _removeNoteAttachment(note, index) {
        const kept = (note.Attachments ?? [])
            .filter((a, i) => i !== index && a && a.base64)
            .map(a => ({
                AttachmentName: a.name,
                AttachmentByteArray: a.base64,
                AttachmentImageType: 0,
            }));
        try {
            const objectInfo = _buildObjectInfo({
                TicketID: State.ticketId,
                NoteID: note.NoteID,
                noteDescription: note.Body ?? '',
                visibleToClient: note.IsVisibleToClient ? '1' : '0',
            });
            const data = await API.post(
                'TicketDetails/SaveNote',
                API.authPayload({ objectInfo, attachments: kept, rfc: false })
            );
            if (!data) throw new Error('SaveNote returned null');
            UI.toast?.('Attachment removed', 'success');
            await _getNotes();
        } catch (err) {
            console.error('Notes._removeNoteAttachment:', err);
            UI.toast?.('Failed to remove attachment', 'error');
        }
    }

    // -------------------------  Get notes  ------------------------- //

    async function _getNotes() {
        try {
            const [data, attMap] = await Promise.all([
                API.post('TicketDetails/GetNotes', API.authPayload({ ticketId: State.ticketId })),
                Composer.fetchNoteAttachments(State.ticketId, 0),
            ]);
            if (!Array.isArray(data)) return;

            // GetNotes does not return attachments; merge them in by noteID.
            data.forEach(n => { n.attachments = attMap.get(n.noteID) ?? n.attachments ?? []; });

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
                OwnerID: n.notesUserID ?? null,
                AuthorName: n.notesAddedBy,
                Body: n.noteDescription,
                CreatedDate: n.noteDate,
                IsVisibleToClient: n.visibleToClient === true,
                Attachments: (n.attachments ?? []).map(a => ({
                    name: a.attachmentName,
                    base64: a.attachmentByteArray,
                    size: null,
                })),
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
            card.appendChild(_buildNoteAttachments(note.Attachments, note));
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

        // Creator-only: edit your own note inline. Optimistic notes
        // (temp id, still saving) are not editable yet.
        if (!note._optimistic && note.OwnerID != null &&
            Session.userID != null && note.OwnerID === Session.userID) {
            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'td-note-edit';
            editBtn.setAttribute('aria-label', 'Edit note');
            editBtn.title = 'Edit';
            editBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" '
                + 'fill="none" stroke="currentColor" stroke-width="2" '
                + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
                + '<path d="M12 20h9"/>'
                + '<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
            editBtn.addEventListener('click', () => _beginNoteEdit(note));
            head.appendChild(editBtn);
        }

        return head;
    }

    function _buildNoteBody(note) {
        const body = document.createElement('div');
        body.className = 'td-note-body';
        body.textContent = note.Body ?? '';
        return body;
    }

    function _buildNoteAttachments(attachments, note) {
        const wrap = document.createElement('div');
        wrap.className = 'td-note-attachments';

        // The note's creator can remove an attachment. Removal re-saves the
        // note with that attachment omitted: the SaveNote proc wipes and
        // re-inserts all attachment slots each save, so the remaining ones
        // simply shift down. No delete endpoint is needed.
        const canRemove = note && !note._optimistic && note.OwnerID != null &&
            Session.userID != null && note.OwnerID === Session.userID;

        attachments.forEach((att, index) => {
            const row = document.createElement('div');
            row.className = 'td-note-file-row';

            const downloadable = !!att.base64;
            const el = document.createElement(downloadable ? 'a' : 'span');
            el.className = 'td-note-file';
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
                <span class="td-file-name">${Format.escapeHtml(att.name)}</span>
                ${att.size != null ? `<span class="td-file-size mono">${Format.fileSizeLabel(att.size)}</span>` : ''}
            `;
            row.appendChild(el);

            if (canRemove) {
                const rm = document.createElement('button');
                rm.type = 'button';
                rm.className = 'td-note-file-remove';
                rm.title = 'Remove attachment';
                rm.setAttribute('aria-label', `Remove ${att.name}`);
                rm.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" '
                    + 'fill="none" stroke="currentColor" stroke-width="2.5" '
                    + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
                    + '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
                rm.addEventListener('click', () => _removeNoteAttachment(note, index));
                row.appendChild(rm);
            }

            wrap.appendChild(row);
        });

        return wrap;
    }

    // -------------------------  Scope reminder  ------------------------- //
    // Dismissible, session-only. Once dismissed it is removed until the
    // ticket is opened fresh.
    const SCOPE_DISMISS_KEY = 'td-notes-scope-dismissed';

    function _initScopeReminder() {
        const banner = Dom.scopeNote();
        if (!banner) return;
        if (sessionStorage.getItem(SCOPE_DISMISS_KEY) === '1') {
            banner.remove();
            return;
        }
        banner.removeAttribute('hidden');
        Dom.scopeDismiss()?.addEventListener('click', () => {
            sessionStorage.setItem(SCOPE_DISMISS_KEY, '1');
            banner.remove();
        });
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
