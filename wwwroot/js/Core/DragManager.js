// wwwroot/js/Core/DragManager.js

const DragManager = (() => {

    // Fix: replaces ondrop="DropNoteBox(event)" ondragover="DragNoteBox(event)"
    // on every detail page Main-Div — single delegated listener
    document.addEventListener('dragover', e => {
        const mainDiv = e.target.closest('#Main-Div');
        if (mainDiv) {
            e.preventDefault();
            DragManager.onNoteBoxDragOver(e);
        }
    });

    document.addEventListener('drop', e => {
        // Fix: replaces ondrop="DropNoteBox(event)" on Main-Div
        const mainDiv = e.target.closest('#Main-Div');
        if (mainDiv) {
            e.preventDefault();
            DragManager.onNoteBoxDrop(e);
        }
    });

    return {
        onNoteBoxDragOver(e) {
            // Fix: was DragNoteBox() — visual feedback during drag
            const noteBox = document.querySelector('.Note-Div');
            if (noteBox) noteBox.classList.add('drag-over');
        },

        onNoteBoxDrop(e) {
            // Fix: was DropNoteBox() — handle dropped note
            const noteBox = document.querySelector('.Note-Div');
            if (noteBox) noteBox.classList.remove('drag-over');

            const data = e.dataTransfer.getData('text/plain');
            if (data) Notes.drop(data, e);
        },

        // Fix: dragleave — remove visual feedback — was missing entirely
        init() {
            document.addEventListener('dragleave', e => {
                const noteBox = document.querySelector('.Note-Div');
                if (noteBox && !e.relatedTarget?.closest('.Note-Div'))
                    noteBox.classList.remove('drag-over');
            });
        }
    };
})();

DragManager.init();
