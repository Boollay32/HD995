// =====================  RFCNotes.js  ===================== //
//
// RFC notes: a thin wrapper over the shared NotesPanel component (which owns
// the thread UI, data layer, and note editing). This binds NotesPanel to the
// RFC note backend (Note/GetRFCNotes + SaveNote with rfc:true) and the RFC
// pane's element ids. NotesPanel.js must load before this file.

'use strict';

const RFCNotes = (() => {

    let _handle = null;

    function init(rfcId) {
        _handle = NotesPanel.init({
            ownerId: parseInt(rfcId, 10),
            ownerField: 'RFCID',
            getEndpoint: 'Note/GetRFCNotes',
            getPayloadKey: 'rfcId',
            attachmentOwnerType: 1,
            rfc: true,
            extraSaveFields: {},
            ids: {
                thread: 'RFCNotes-Thread',
                textarea: 'rfc-note-textarea',
                sendBtn: 'rfc-note-send-btn',
                charcount: 'rfc-note-charcount',
                fileInput: 'rfc-note-file-input',
                attachList: 'rfc-note-attachment-list',
                composerDock: 'RFCNotes-Compose',
            },
        });
        return _handle;
    }

    return {
        init,
        // Route through the instance handle init returned (NotesPanel is a
        // factory now; there is no singleton NotesPanel.refresh).
        refresh: () => _handle && _handle.refresh(),
    };

})();
