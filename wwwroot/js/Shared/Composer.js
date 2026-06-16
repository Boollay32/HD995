// =====================  Composer.js  ===================== //
//
// Reusable message/note composer. Owns the input box (char-count, auto-grow,
// enter-to-send), the pending-attachment list (chips, add/remove, drag-drop),
// and base64 encoding/download of attachments. Rendering of the thread itself
// stays with each consumer (note cards vs chat bubbles).
//
// Usage:
//   const composer = Composer.create({
//       textarea: 'note-textarea', sendBtn: 'note-send-btn',
//       charcount: 'note-charcount', fileInput: 'note-file-input',
//       attachList: 'note-attachment-list', composerDock: 'Notes-Compose',
//       attachBtn: '#Notes-Compose .td-attach-btn',
//       charLimit: 2000, enableAttachments: true,
//       onSend: async ({ text, files }) => { ... return true; },  // boolean = success
//   });
//
// onSend owns its own optimistic render / save / error handling and returns
// true on success (composer clears) or false (composer keeps the text).

'use strict';

const Composer = (() => {

    const DEFAULT_CHAR_LIMIT = 2000;
    const MAX_FILE_SIZE_MB = 10;
    const MAX_FILE_SIZE_B = MAX_FILE_SIZE_MB * 1024 * 1024;
    const MAX_ATTACHMENTS = 5;

    const byId = id => (typeof id === 'string' ? document.getElementById(id) : id);

    const MIME_BY_EXT = {
        pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv',
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
        webp: 'image/webp', bmp: 'image/bmp', tiff: 'image/tiff',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        zip: 'application/zip',
    };

    function _mimeFromName(name) {
        const ext = name?.split('.').pop()?.toLowerCase() ?? '';
        return MIME_BY_EXT[ext] ?? 'application/octet-stream';
    }

    // Server stores AttachmentImageType as an int (see setImageTypeId):
    // 1 = image, 2 = pdf, 3 = other.
    function _imageTypeId(mime) {
        const m = (mime || '').toLowerCase();
        if (m.startsWith('image/')) return 1;
        if (m === 'application/pdf') return 2;
        return 3;
    }

    // ---- static helpers (usable without an instance) ---- //

    // Encode File objects to the SaveNote attachment shape.
    async function encode(files) {
        if (!files || !files.length) return [];
        return Promise.all(Array.from(files).map(file => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({
                AttachmentName: file.name,
                AttachmentByteArray: reader.result.split(',')[1], // base64 only
                AttachmentImageType: _imageTypeId(file.type),
            });
            reader.onerror = reject;
            reader.readAsDataURL(file);
        })));
    }

    // Trigger a download of a base64 attachment (reconstructs a Blob locally;
    // note/message attachments come back as base64, not URLs).
    function download(name, base64) {
        if (!base64) return;
        try {
            // Stored attachments arrive in several shapes: with a data-URI
            // prefix, with whitespace/newlines, or as URL-safe base64. All of
            // these blow up a strict atob, so normalise before decoding.
            let b64 = String(base64).trim();
            const comma = b64.indexOf(',');
            if (b64.startsWith('data:') && comma >= 0) b64 = b64.slice(comma + 1);
            b64 = b64.replace(/ /g, '+').replace(/[\r\n\t]+/g, '').replace(/-/g, '+').replace(/_/g, '/');
            if (b64.length % 4) b64 += '='.repeat(4 - (b64.length % 4));
            const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
            const blob = new Blob([bytes], { type: _mimeFromName(name) });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = name || 'attachment';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) {
            console.error('Composer.download:', err);
            UI.toast?.('Could not open attachment', 'error');
        }
    }

    // Fetch all note attachments for a ticket/RFC and group them by noteID.
    // GetNotes does not return attachments, so they are loaded separately and
    // merged client-side. Returns a Map(noteID -> [attachment, ...]).
    async function fetchNoteAttachments(id, rfc = 0) {
        try {
            const data = await API.post(
                'Attachment/GetAttachmentsNotes',
                API.authPayload({ ticketId: id, rfc })
            );
            const map = new Map();
            (Array.isArray(data) ? data : []).forEach(a => {
                const nid = a.noteID;
                if (nid == null) return;
                if (!map.has(nid)) map.set(nid, []);
                map.get(nid).push(a);
            });
            return map;
        } catch (err) {
            console.error('Composer.fetchNoteAttachments:', err);
            return new Map();
        }
    }

    // Fetch all task attachments for a ticket, grouped by taskID. Mirrors
    // fetchNoteAttachments; GetAttachmentsTasks returns rows keyed by
    // noteID, which carries the TaskID for tasks.
    async function fetchTaskAttachments(ticketId) {
        try {
            const data = await API.post(
                'Attachment/GetAttachmentsTasks',
                API.authPayload({ ticketId })
            );
            const map = new Map();
            (Array.isArray(data) ? data : []).forEach(a => {
                const tid = a.noteID;
                if (tid == null) return;
                if (!map.has(tid)) map.set(tid, []);
                map.get(tid).push(a);
            });
            return map;
        } catch (err) {
            console.error('Composer.fetchTaskAttachments:', err);
            return new Map();
        }
    }

    // ---- instance ---- //

    function create(cfg) {
        const textarea = byId(cfg.textarea);
        const sendBtn = byId(cfg.sendBtn);
        if (!textarea || !sendBtn) return { clear() {}, files: () => [] };

        const charLimit = cfg.charLimit ?? DEFAULT_CHAR_LIMIT;
        const enableAttachments = cfg.enableAttachments !== false;
        const onSend = typeof cfg.onSend === 'function' ? cfg.onSend : async () => false;

        const charcount = byId(cfg.charcount);
        const fileInput = byId(cfg.fileInput);
        const attachList = byId(cfg.attachList);
        const composerDock = byId(cfg.composerDock);
        const attachBtn = cfg.attachBtn
            ? (typeof cfg.attachBtn === 'string' ? document.querySelector(cfg.attachBtn) : cfg.attachBtn)
            : null;

        let pendingFiles = [];
        let sending = false;

        // ---- input UX ---- //

        textarea.addEventListener('input', () => {
            const len = textarea.value.length;
            if (charcount) {
                charcount.textContent = `${len} / ${charLimit}`;
                charcount.classList.toggle('is-near-limit', len >= charLimit * 0.85);
                charcount.classList.toggle('is-at-limit', len >= charLimit);
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

        sendBtn.addEventListener('click', _doSend);

        // ---- attachments ---- //

        if (!enableAttachments) {
            attachBtn?.setAttribute('hidden', '');
        } else {
            fileInput?.addEventListener('change', (e) => _add(e.target.files));

            composerDock?.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                composerDock.classList.add('is-dragover');
            });
            composerDock?.addEventListener('dragleave', () => composerDock.classList.remove('is-dragover'));
            composerDock?.addEventListener('drop', (e) => {
                e.preventDefault();
                composerDock.classList.remove('is-dragover');
                _add(e.dataTransfer.files);
            });
        }

        function _add(files) {
            const remaining = MAX_ATTACHMENTS - pendingFiles.length;
            if (remaining <= 0) {
                UI.toast?.(`Maximum ${MAX_ATTACHMENTS} attachments allowed`, 'warning');
                return;
            }
            const toAdd = Array.from(files).slice(0, remaining);
            const rejected = [];
            toAdd.forEach(file => {
                if (file.size > MAX_FILE_SIZE_B) { rejected.push(file.name); return; }
                pendingFiles.push(file);
            });
            if (rejected.length > 0) {
                UI.toast?.(`${rejected.join(', ')} exceeded ${MAX_FILE_SIZE_MB}MB limit`, 'warning');
            }
            _renderChips();
            if (fileInput) fileInput.value = ''; // allow re-adding same file after removal
        }

        function _remove(index) {
            pendingFiles.splice(index, 1);
            _renderChips();
        }

        function _renderChips() {
            if (!attachList) return;
            attachList.innerHTML = '';
            pendingFiles.forEach((file, i) => attachList.appendChild(_buildChip(file, i)));
        }

        function _buildChip(file, index) {
            const chip = document.createElement('div');
            chip.className = 'td-attach-chip';
            chip.dataset.index = index;
            chip.innerHTML = `
                <span aria-hidden="true">${Format.fileIcon(file.name)}</span>
                <span class="td-chip-name">${Format.escapeHtml(file.name)}</span>
                <span class="td-chip-size mono">${Format.fileSizeLabel(file.size)}</span>
                <button type="button" aria-label="Remove ${Format.escapeHtml(file.name)}" data-index="${index}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" stroke-width="2.5"
                         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>`;
            chip.querySelector('button')?.addEventListener('click', () => _remove(index));
            return chip;
        }

        function _clearFiles() {
            pendingFiles = [];
            _renderChips();
        }

        function _clearText() {
            textarea.value = '';
            textarea.style.height = 'auto';
            sendBtn.disabled = true;
            if (charcount) {
                charcount.textContent = `0 / ${charLimit}`;
                charcount.classList.remove('is-near-limit', 'is-at-limit');
            }
        }

        // ---- send ---- //

        async function _doSend() {
            if (sending) return;
            const text = textarea.value.trim();
            if (!text) return; // send button is text-gated, matching prior behaviour

            sending = true;
            sendBtn.disabled = true;

            const files = enableAttachments ? pendingFiles.slice() : [];
            let ok = false;
            try {
                ok = await onSend({ text, files });
            } catch (err) {
                console.error('Composer.onSend:', err);
                ok = false;
            } finally {
                sending = false;
                if (ok) {
                    _clearText();
                    _clearFiles();
                } else {
                    sendBtn.disabled = textarea.value.trim().length === 0;
                }
            }
        }

        return {
            clear() { _clearText(); _clearFiles(); },
            files: () => pendingFiles.slice(),
        };
    }

    return { create, encode, download, fetchNoteAttachments, fetchTaskAttachments };

})();

// ---------------------------------------------------------------------------
// SaveOriginalNote -- shared global. The description entered when creating a
// ticket or RFC becomes the record's FIRST note (client-visible for tickets),
// carrying any attachments. Legacy call signature preserved:
//   SaveOriginalNote(files, isRfc, note, id)
// This was previously called in three places but defined nowhere, so every
// ticket/RFC creation threw right after the record was created and the first
// note (and its attachments) never saved.
// ---------------------------------------------------------------------------

async function SaveOriginalNote(files, isRfc, note, id) {
    if (!note || !id) return null;

    const fields = isRfc
        ? { RFCID: id, noteDescription: note }
        : { TicketID: id, noteDescription: note, visibleToClient: '1' };

    const objectInfo = Object.entries(fields)
        .map(([key, value]) => `${key}\`${value}`)
        .join('|');

    const fileList = (files && typeof files.length === 'number') ? files : [];
    const attachments = await Composer.encode(fileList);

    return API.post(
        isRfc ? 'Note/SaveNote' : 'TicketDetails/SaveNote',
        API.authPayload({ objectInfo, attachments, rfc: !!isRfc })
    );
}
