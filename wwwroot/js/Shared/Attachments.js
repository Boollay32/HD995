// Attachments.js -- the single canonical attachment renderer for the whole app
// (messages, notes, tasks, description, compose forms). One layout, reused; no
// per-caller duplication.
//
// A fixed-size file-icon tile that never resizes or reflows. Hovering the tile
// reveals a popout with the filename (and size, when known). Saved files (those
// carrying base64) download on click. A circular remove badge sits on the tile's
// top-right corner -- it is revealed on hover and rendered ONLY when the caller
// passes canRemove:true, i.e. when the parent item is in edit mode.
//
//   items : array of { name, base64?, size? }  (saved)
//           or File objects                     (pending compose)
//   opts  : { canRemove:bool, onRemove:(item,index)=>{}, showSize:bool }
//
//   Attachments.render(items, opts) -> HTMLElement (the list wrapper)
(function () {
    'use strict';

    function _name(it) { return (it && (it.name != null ? it.name : it.AttachmentName)) || 'file'; }
    function _b64(it)  { return it ? (it.base64 != null ? it.base64 : (it.AttachmentByteArray != null ? it.AttachmentByteArray : null)) : null; }
    function _size(it) { return (it && it.size != null) ? it.size : null; }

    function _group(it, index, opts) {
        const name = _name(it);
        const b64 = _b64(it);
        const downloadable = !!b64;

        const group = document.createElement('span');
        group.className = 'td-attach';

        // Popout: filename (+ size). Sits above the tile, never affects layout.
        const pop = document.createElement('span');
        pop.className = 'td-attach-pop';
        pop.appendChild(document.createTextNode(name));
        const size = _size(it);
        if (opts.showSize !== false && size != null && window.Format && Format.fileSizeLabel) {
            const sz = document.createElement('span');
            sz.className = 'td-attach-pop-sz';
            sz.textContent = Format.fileSizeLabel(size);
            pop.appendChild(sz);
        }
        group.appendChild(pop);

        // Tile: the file icon. An anchor when the file can be downloaded.
        const tile = document.createElement(downloadable ? 'a' : 'span');
        tile.className = 'td-attach-tile';
        tile.innerHTML = (window.Format && Format.fileIcon) ? Format.fileIcon(name) : '';
        if (downloadable) {
            tile.href = '#';
            tile.setAttribute('aria-label', 'Download ' + name);
            tile.addEventListener('click', function (e) {
                e.preventDefault();
                if (window.Composer && Composer.download) Composer.download(name, b64);
            });
        } else {
            tile.setAttribute('aria-label', name);
        }
        group.appendChild(tile);

        // Remove badge: only when editable; CSS reveals it on hover.
        if (opts.canRemove && typeof opts.onRemove === 'function') {
            const rm = document.createElement('button');
            rm.type = 'button';
            rm.className = 'td-attach-x';
            rm.title = 'Remove';
            rm.setAttribute('aria-label', 'Remove ' + name);
            rm.innerHTML = '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" '
                + 'stroke="currentColor" stroke-width="3" stroke-linecap="round" '
                + 'stroke-linejoin="round" aria-hidden="true">'
                + '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
            rm.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                opts.onRemove(it, index);
            });
            group.appendChild(rm);
            group.classList.add('is-removable');
        }
        return group;
    }

    function render(items, options) {
        const opts = options || {};
        const wrap = document.createElement('div');
        wrap.className = 'td-attach-list';
        (Array.isArray(items) ? items : []).forEach(function (it, i) {
            wrap.appendChild(_group(it, i, opts));
        });
        return wrap;
    }

    window.Attachments = { render: render };
})();
