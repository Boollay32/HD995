// =====================  NotesPanel.js  ===================== //
//
// A generalised left-pane Notes thread, extracted from RFCNotes. It is a
// plain thread (no client/internal visibility toggle), config-driven so the
// same component can serve different owners: RFC notes, and the internal
// (project / incident) ticket Notes pane. The caller passes element ids, the
// owner id + field, the load endpoint + payload key, the attachment owner
// type, the SaveNote rfc flag, and any extra save fields (e.g. an internal
// visibleToClient for ticket notes).
//
// Shared concerns are delegated: display helpers -> Format.js, and the
// composer (input, char-count, attachments, drag-drop) -> Composer.js.
// This file owns the data layer (load/normalise/save) and the note-card
// rendering, styled by Components/NoteThread.css.

'use strict';

const NotesPanel = (() => {

    // -------------------------  Constants / State  ------------------------- //

    const CHAR_LIMIT = 2000;

    const State = {
        config: null,
        notes: [],
    };

    const Dom = {
        thread: () => document.getElementById(State.config.ids.thread),
    };

    const Session = {
        get userName() { return sessionStorage.getItem(STORAGE_KEYS.USER_NAME); },
        get userId() {
            const id = parseInt(sessionStorage.getItem(STORAGE_KEYS.USER_ID), 10);
            return Number.isNaN(id) ? null : id;
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

    // Estimate decoded byte length of a base64 string (for size labels).
    function _b64Bytes(b64) {
        if (!b64) return null;
        const len = b64.length;
        const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
        return Math.max(0, Math.floor(len * 3 / 4) - pad);
    }

    // -------------------------  Init  ------------------------- //

    function init(config) {
        State.config = config;

        composer = Composer.create({
            textarea: config.ids.textarea,
            sendBtn: config.ids.sendBtn,
            charcount: config.ids.charcount,
            fileInput: config.ids.fileInput,
            attachList: config.ids.attachList,
            composerDock: config.ids.composerDock,
            charLimit: CHAR_LIMIT,
            enableAttachments: true,
            onSend: _onSend,
        });

        // Optional scope reminder (opt-in via config.scope); no-op otherwise.
        _initScope();

        // Return the load promise so the caller can await the notes alongside
        // the rest of the page data.
        return _getNotes();
    }

    // -------------------------  Scope reminder (opt-in)  ------------------------- //
    // Dismissible, session-only "internal only" banner. Active only when the
    // caller supplies config.scope = { banner, dismiss, dismissKey }; the
    // project/incident left pane and RFC omit it, so this is a no-op for them.
    // The dismiss is revealed + wired here in one place, so it survives + works.
    function _initScope() {
        const sc = State.config.scope;
        if (!sc || !sc.banner) return;
        const banner = document.getElementById(sc.banner);
        if (!banner) return;
        const key = sc.dismissKey || 'td-notes-scope-dismissed';
        if (sessionStorage.getItem(key) === '1') {
            banner.remove();
            return;
        }
        banner.removeAttribute('hidden');
        document.getElementById(sc.dismiss)?.addEventListener('click', () => {
            sessionStorage.setItem(key, '1');
            banner.remove();
        });
    }

    // -------------------------  Send (onSend callback)  ------------------------- //

    async function _onSend({ text, files }) {
        const tempId = `temp-${Date.now()}`;
        _appendNote(_buildOptimisticNote(tempId, text, files));

        try {
            const objectInfo = _buildObjectInfo({
                [State.config.ownerField]: State.config.ownerId,
                noteDescription: text,
                ...State.config.extraSaveFields,
            });

            const attachments = await Composer.encode(files);

            const data = await API.post(
                'Note/SaveNote',
                API.authPayload({ objectInfo, attachments, rfc: State.config.rfc })
            );

            if (!data) throw new Error('SaveNote returned null');

            // SaveNote returns a result object (not the note list) and note
            // attachments are loaded separately, so re-fetch to render them.
            await _getNotes();
            return true;

        } catch (err) {
            console.error('NotesPanel._onSend:', err);
            _removeOptimisticNote(tempId);
            UI.toast?.('Failed to add note', 'error');
            return false;
        }
    }

    function _buildOptimisticNote(tempId, body, files) {
        return {
            NoteID: tempId,
            AuthorName: Session.userName ?? 'You',
            AuthorUserID: Session.userId,
            Body: body,
            CreatedDate: new Date().toISOString(),
            Attachments: (files ?? []).map(f => ({ name: f.name, size: f.size, base64: null })),
            _optimistic: true,
        };
    }

    // -------------------------  Get notes  ------------------------- //

    async function _getNotes() {
        try {
            const [data, attMap] = await Promise.all([
                API.post(State.config.getEndpoint, API.authPayload({ [State.config.getPayloadKey]: State.config.ownerId })),
                Composer.fetchNoteAttachments(State.config.ownerId, State.config.attachmentOwnerType),
            ]);
            if (!Array.isArray(data)) return;

            // GetRFCNotes does not return attachments; merge them in by noteID.
            data.forEach(n => { n.attachments = attMap.get(n.noteID) ?? n.attachments ?? []; });

            State.notes = data;
            _renderNotes(data);

        } catch (err) {
            console.error('NotesPanel._getNotes:', err);
            UI.toast?.('Failed to load notes', 'error');
        }
    }

    // -------------------------  Normalise  ------------------------- //
    // RFC notes arrive camelCase (NoteStub, RFC branch): noteID, notesAddedBy,
    // noteDescription, noteDate, notesUserID. There is no visibleToClient.

    function _normNote(n) {
        if (n && n.noteID !== undefined) {
            return {
                NoteID: n.noteID,
                AuthorName: n.notesAddedBy,
                AuthorUserID: n.notesUserID,
                Body: n.noteDescription,
                CreatedDate: n.noteDate,
                VisibleToClient: n.visibleToClient === true,
                Attachments: (n.attachments ?? []).map(a => ({
                    name: a.attachmentName,
                    base64: a.attachmentByteArray,
                    imageType: a.attachmentImageType,
                    size: _b64Bytes(a.attachmentByteArray),
                })),
            };
        }
        return n; // already card-shaped (optimistic)
    }

    // -------------------------  Render  ------------------------- //

    function _renderNotes(notes) {
        const thread = Dom.thread();
        if (!thread) return;

        thread.innerHTML = '';

        const list = (Array.isArray(notes) ? notes : []).map(_normNote);

        if (list.length === 0) {
            thread.appendChild(_buildEmptyState());
            return;
        }

        const fragment = document.createDocumentFragment();
        list.forEach(note => fragment.appendChild(_buildNoteCard(note)));
        thread.appendChild(fragment);

        _scrollToBottom(false);
    }

    function _appendNote(note) {
        const thread = Dom.thread();
        if (!thread) return;

        thread.querySelector('.td-thread-empty')?.remove();
        thread.appendChild(_buildNoteCard(_normNote(note)));
        _scrollToBottom(true);
    }

    function _removeOptimisticNote(tempId) {
        Dom.thread()?.querySelector(`[data-nid="${tempId}"]`)?.remove();
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
            <p>No notes yet.<br>Add the first note below.</p>
        `;
        return div;
    }

    function _scrollToBottom(smooth = true) {
        const thread = Dom.thread();
        if (!thread) return;
        thread.scrollTo({ top: thread.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
    }

    // -------------------------  Note card  ------------------------- //

    function _buildNoteCard(note) {
        const card = document.createElement('div');
        card.className = 'td-note-card';
        card.dataset.nid = note.NoteID;
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
        author.textContent = note.AuthorName ?? 'Unknown';
        head.appendChild(author);

        const time = document.createElement('span');
        time.className = 'td-note-time';
        time.textContent = Format.formatDateTime(note.CreatedDate);
        time.setAttribute('title', note.CreatedDate ?? '');
        head.appendChild(time);

        // Edit affordance — only on the current user's own (already-saved) notes.
        if (_canEdit(note)) {
            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'td-note-edit';
            editBtn.title = 'Edit note';
            editBtn.setAttribute('aria-label', 'Edit note');
            editBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2"
                     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M12 20h9"/>
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                </svg>`;
            editBtn.addEventListener('click', () =>
                _enterEditMode(editBtn.closest('.td-note-card'), note));
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

    function _buildNoteAttachments(attachments) {
        // Canonical rendering via the shared Attachments component. Note display
        // is read-only here (removal happens through the note editor), so no
        // remove badge.
        return Attachments.render(attachments, { canRemove: false, showSize: true });
    }

    // -------------------------  Edit own note  ------------------------- //
    // The backend SaveNote upserts: passing an existing NoteID updates that
    // note (proc usp_Helpdesk_RFCManageNotes). We only expose this on the
    // current user's own, already-saved notes; the server stamps the editor's
    // id from the auth context. Text-only edit — attachments are left as-is
    // (no attachment params are sent, so none are added).

    function _canEdit(note) {
        return !note._optimistic
            && typeof note.NoteID === 'number'
            && Session.userId != null
            && note.AuthorUserID === Session.userId;
    }

    function _enterEditMode(card, note) {
        if (!card || card.classList.contains('is-editing')) return;
        const body = card.querySelector('.td-note-body');
        if (!body) return;

        card.classList.add('is-editing');
        body.hidden = true;
        // Hide the card's static attachment list; the editor shows an editable
        // copy below instead.
        const staticAtts = card.querySelector('.td-attach-list');
        if (staticAtts) staticAtts.hidden = true;

        // Working attachment set. The save proc REPLACES a note's attachments
        // with whatever we send, so editing = re-send the set we want to keep:
        //   existing kept (re-sent) + newly added files, minus any removed.
        const working = (note.Attachments ?? []).map(a => ({
            kind: 'existing', name: a.name, base64: a.base64,
            imageType: a.imageType, size: a.size,
        }));
        let attachmentsDirty = false;

        const editor = document.createElement('div');
        editor.className = 'td-note-editor';

        const ta = document.createElement('textarea');
        ta.className = 'td-note-edit-input';
        ta.maxLength = CHAR_LIMIT;
        ta.value = note.Body ?? '';
        editor.appendChild(ta);

        const attachWrap = document.createElement('div');
        attachWrap.className = 'td-note-edit-attachments';
        editor.appendChild(attachWrap);

        const bar = document.createElement('div');
        bar.className = 'td-note-edit-bar';

        const addLabel = document.createElement('label');
        addLabel.className = 'td-attach-btn';
        addLabel.title = 'Attach files';
        addLabel.setAttribute('aria-label', 'Attach files');
        addLabel.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
            aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66L9.41 17.41a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>`;
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple = true;
        fileInput.className = 'sr-only';
        addLabel.appendChild(fileInput);

        const actions = document.createElement('div');
        actions.className = 'td-note-edit-actions';
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'td-note-edit-cancel';
        cancelBtn.textContent = 'Cancel';
        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'td-note-edit-save';
        saveBtn.textContent = 'Save';
        actions.appendChild(cancelBtn);
        actions.appendChild(saveBtn);

        bar.appendChild(addLabel);
        bar.appendChild(actions);
        editor.appendChild(bar);

        function renderChips() {
            // Canonical attachment tiles via the shared Attachments component.
            attachWrap.replaceChildren(Attachments.render(working, {
                canRemove: true,
                onRemove: (att, idx) => {
                    working.splice(idx, 1);
                    attachmentsDirty = true;
                    renderChips();
                },
                showSize: true,
            }));
        }

        fileInput.addEventListener('change', (e) => {
            for (const f of Array.from(e.target.files || [])) {
                if (working.length >= 5) { UI.toast?.('Up to 5 attachments per note', 'error'); break; }
                if (f.size > 10 * 1024 * 1024) { UI.toast?.(`${f.name} is over 10MB`, 'error'); continue; }
                working.push({ kind: 'new', name: f.name, size: f.size, file: f });
                attachmentsDirty = true;
            }
            fileInput.value = '';
            renderChips();
        });

        cancelBtn.addEventListener('click', () => _exitEditMode(card, note));
        saveBtn.addEventListener('click', () => {
            const next = ta.value.trim();
            if (next === '') { UI.toast?.('Note text can\u2019t be empty', 'error'); return; }
            if (next === (note.Body ?? '') && !attachmentsDirty) { _exitEditMode(card, note); return; }
            _commitEdit(card, note, next, working, { cancelBtn, saveBtn });
        });

        renderChips();
        body.insertAdjacentElement('afterend', editor);

        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
        ta.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { e.preventDefault(); _exitEditMode(card, note); }
            else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); saveBtn.click(); }
        });
    }

    function _exitEditMode(card, note) {
        if (!card) return;
        card.classList.remove('is-editing');
        card.querySelector('.td-note-editor')?.remove();
        const body = card.querySelector('.td-note-body');
        if (body) {
            body.textContent = note.Body ?? '';
            body.hidden = false;
        }
        const staticAtts = card.querySelector('.td-attach-list');
        if (staticAtts) staticAtts.hidden = false;
    }

    async function _commitEdit(card, note, newText, working, btns) {
        const { cancelBtn, saveBtn } = btns;
        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving\u2026'; }
        if (cancelBtn) cancelBtn.disabled = true;

        try {
            // Build the full desired attachment set: re-send kept existing ones
            // (their stored bytes) plus newly added files. Removed ones are
            // simply absent, so the replace-on-save proc drops them.
            const newFiles = working.filter(a => a.kind === 'new').map(a => a.file);
            const encodedNew = newFiles.length ? await Composer.encode(newFiles) : [];
            const keptExisting = working
                .filter(a => a.kind === 'existing')
                .map(a => ({
                    AttachmentName: a.name,
                    AttachmentByteArray: a.base64,
                    AttachmentImageType: a.imageType,
                }));
            const attachments = [...keptExisting, ...encodedNew];

            const objectInfo = _buildObjectInfo({
                [State.config.ownerField]: State.config.ownerId,
                NoteID: note.NoteID,
                noteDescription: newText,
                ...State.config.extraSaveFields,
            });

            const data = await API.post(
                'Note/SaveNote',
                API.authPayload({ objectInfo, attachments, rfc: State.config.rfc })
            );
            if (!data) throw new Error('SaveNote returned null');

            // Reflect saved state locally (replace semantics: the set we sent is
            // now the note's attachment set) and rebuild the card.
            note.Body = newText;
            note.Attachments = attachments.map(a => ({
                name: a.AttachmentName,
                base64: a.AttachmentByteArray,
                imageType: a.AttachmentImageType,
                size: _b64Bytes(a.AttachmentByteArray),
            }));
            const stored = State.notes.find(n => n.noteID === note.NoteID);
            if (stored) stored.noteDescription = newText;

            card.replaceWith(_buildNoteCard(note));
            UI.toast?.('Note updated', 'success');

        } catch (err) {
            console.error('NotesPanel._commitEdit:', err);
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
            if (cancelBtn) cancelBtn.disabled = false;
            UI.toast?.('Failed to update note', 'error');
        }
    }

    // -------------------------  Public API  ------------------------- //

    return {
        init,
        refresh: _getNotes,
    };

})();
