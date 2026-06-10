// =============================  UI.js  ============================= //

const UI = {

    // -------------------------  Constants  ------------------------- //

    _detailHeightOffset: 180,
    _detailWidthOffset: 450,

    // -------------------------  Show / Hide by ID  ------------------------- //

    show(id) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'block';
    },

    hide(id) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    },

    toggle(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.display = el.style.display === 'none' ? 'block' : 'none';
    },

    // -------------------------  Show / Hide Multiple by ID  ------------------------- //

    showAll(idsString) {
        this._applyToIds(idsString, el => { el.style.display = 'block'; });
    },

    hideAll(idsString) {
        this._applyToIds(idsString, el => { el.style.display = 'none'; });
    },

    // Aliases — used in AdminPage / UserDetails
    showById(idsString) { this.showAll(idsString); },
    hideById(idsString) { this.hideAll(idsString); },

    _applyToIds(idsString, fn) {
        if (!idsString) return;
        for (const id of idsString.split(',')) {
            const el = document.getElementById(id.trim());
            if (el) fn(el);
        }
    },

    // -------------------------  Enable / Disable by ID  ------------------------- //

    enable(idsString) {
        this._applyToIds(idsString, el => { el.disabled = false; });
    },

    disable(idsString) {
        this._applyToIds(idsString, el => { el.disabled = true; });
    },

    // Aliases — used in UserDetails
    enableById(idsString) { this.enable(idsString); },
    disableById(idsString) { this.disable(idsString); },

    // -------------------------  Show / Hide by Object  ------------------------- //

    toggleObject(el) {
        if (!el) return;
        el.style.display = el.style.display === 'block' ? 'none' : 'block';
    },

    showObject(el) {
        if (el) el.style.display = 'block';
    },

    hideObject(el) {
        if (el) el.style.display = 'none';
    },

    // -------------------------  Show / Hide by Tag Name  ------------------------- //

    showByTag(tagsString) {
        this._applyToTags(tagsString, el => {
            if (el.style.display !== 'block') el.style.display = 'block';
        });
    },

    hideByTag(tagsString) {
        this._applyToTags(tagsString, el => {
            if (el.style.display === 'block') el.style.display = 'none';
        });
    },

    _applyToTags(tagsString, fn) {
        if (!tagsString) return;
        for (const tag of tagsString.split(',')) {
            const els = document.getElementsByTagName(tag.trim());
            if (els[0]) fn(els[0]);
        }
    },

    // -------------------------  Waiting / Loading  ------------------------- //

    toggleWaiting() {
        const bg = document.getElementById('Toggle-BlackBackground');
        const body = document.body;
        const navbarLeft = document.querySelector('.navbar-left');
        const mainDiv = document.querySelector('.Main-Div');
        const isWaiting = body.classList.contains('waiting');

        body.classList.toggle('waiting', !isWaiting);
        navbarLeft?.classList.toggle('waiting', !isWaiting);
        mainDiv?.classList.toggle('waiting', !isWaiting);

        if (bg) bg.style.display = isWaiting ? 'none' : 'block';
    },

    // -------------------------  Tooltip  ------------------------- //

    showTooltip(item) {
        const pos = item.getBoundingClientRect();
        const popup = document.getElementById('PopupBox');
        if (!popup) return;

        popup.style.left = `${pos.left + 40}px`;
        popup.style.top = `${pos.top + 5}px`;
        popup.innerHTML = item.getAttribute('tooltip') ?? '';
        popup.style.display = 'block';
    },

    hideTooltip() {
        const popup = document.getElementById('PopupBox');
        if (popup) popup.style.display = 'none';
    },

    // -------------------------  Text Areas  ------------------------- //

    autoGrow(element) {
        if (!element) return;
        element.style.height = 'auto';
        element.style.height = `${element.scrollHeight}px`;
    },

    adjustTextAreas() {
        for (const ta of document.getElementsByTagName('textarea')) {
            this.autoGrow(ta);
        }
    },

    // -------------------------  Detail Window  ------------------------- //


    setDetailWindowSize() {
        const height = window.innerHeight - this._detailHeightOffset;
        const width = window.innerWidth - this._detailWidthOffset;
        const detail = document.getElementById('Detail-Body');
        if (detail) {
            detail.style.height = `${height}px`;
            detail.style.width = `${width}px`;
        }
    },

    // Fix: removed 'static' — not valid in object literal
    showFileDetail(element) {
        if (!element) return;
        const label = element.closest('.Attachment-Icon')
            ?.querySelector('#Attach-Label');
        if (label) label.textContent = element.files?.[0]?.name ?? '';
    },

    // Fix: removed 'static' — not valid in object literal
    hideFileDetail() {
        document.querySelectorAll('#Attach-Label')
            .forEach(l => l.textContent = '');
    }
};

// -------------------------  Global  ------------------------- //

if (typeof window !== 'undefined') {
    window.UI = UI;
}

// -------------------------  Initialise  ------------------------- //

// Delegated resize listener
document.addEventListener('input', e => {
    if (e.target.tagName === 'TEXTAREA') UI.autoGrow(e.target);
});

// Initial sizing on load
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('textarea').forEach(t => UI.autoGrow(t));
});

document.addEventListener('mouseover', e => {
    const input = e.target.closest('input[type="file"]');
    if (input) UI.showFileDetail(input);
});

document.addEventListener('mouseout', e => {
    const input = e.target.closest('input[type="file"]');
    if (input) UI.hideFileDetail();
});

// -------------------------  Legacy Wrappers  ------------------------- //

function DisplayAndHideItemsById(ids, display) { display ? UI.showAll(ids) : UI.hideAll(ids); }
function EnableAndDisableItemsById(ids, disabled) { disabled ? UI.disable(ids) : UI.enable(ids); }
function DisplayAndHideItemsByObject(el, display) { display ? UI.showObject(el) : UI.hideObject(el); }  // Fix: hideObject not toggleObject
function DisplayAndHideItemsByTagName(tags, display) { display ? UI.showByTag(tags) : UI.hideByTag(tags); }
function ToggleWaiting() { UI.toggleWaiting(); }
function DisplayToolTip(item) { UI.showTooltip(item); }
function HideToolTip() { UI.hideTooltip(); }

// -------------------------  Toasts + avatars (additive)  ------------------------- //
// UI.toast was referenced throughout (always via UI.toast?.()) but never
// implemented, so all save/error feedback was silently dropped. Self-styling:
// injects its CSS once, themed on the global tokens.

UI.toast = function (message, type = 'info') {
    UI._ensureToastStyles();
    let host = document.getElementById('ui-toast-host');
    if (!host) {
        host = document.createElement('div');
        host.id = 'ui-toast-host';
        document.body.appendChild(host);
    }
    const el = document.createElement('div');
    el.className = `ui-toast ui-toast--${type}`;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.textContent = message;
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-in'));
    setTimeout(() => {
        el.classList.remove('is-in');
        setTimeout(() => el.remove(), 300);
    }, 3200);
};

UI._ensureToastStyles = function () {
    if (document.getElementById('ui-toast-styles')) return;
    const s = document.createElement('style');
    s.id = 'ui-toast-styles';
    s.textContent = `
#ui-toast-host { position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%);
  display: flex; flex-direction: column; gap: 8px; z-index: 4000; pointer-events: none; }
.ui-toast { font-family: 'Spline Sans', system-ui, sans-serif; font-size: 13.5px; font-weight: 500;
  background: var(--panel, #fff); color: var(--text, #1D1C1A);
  border: 1px solid var(--border, #D8D3C8); border-left-width: 4px; border-radius: 9px;
  padding: 10px 16px; box-shadow: 0 6px 22px rgba(0,0,0,0.18);
  opacity: 0; transform: translateY(8px); transition: opacity .25s ease, transform .25s ease; }
.ui-toast.is-in { opacity: 1; transform: translateY(0); }
.ui-toast--success { border-left-color: var(--ok, #2e7d32); }
.ui-toast--error   { border-left-color: var(--danger, #c62828); }
.ui-toast--warning { border-left-color: var(--warn, #ed6c02); }
.ui-toast--info    { border-left-color: var(--info, #0277bd); }
.ui-av { display: inline-flex; align-items: center; justify-content: center;
  width: 18px; height: 18px; border-radius: 50%; margin-right: 6px; flex: none;
  font-family: 'Spline Sans', system-ui, sans-serif; font-size: 9.5px; font-weight: 700;
  color: #fff; letter-spacing: .02em; vertical-align: -4px; }
`;
    document.head.appendChild(s);
};

// Colour-hashed initials avatar (same palette as the queue assignee chips).
UI.AV_PALETTE = ['#5A6470', '#1E51C0', '#A25A06', '#6D28C9', '#B23121', '#0E6E80'];

UI.avatarColor = function (name) {
    let h = 0;
    for (const c of (name || '')) h = c.charCodeAt(0) + ((h << 5) - h);
    return UI.AV_PALETTE[Math.abs(h) % UI.AV_PALETTE.length];
};

UI.avatarEl = function (name) {
    UI._ensureToastStyles();   // .ui-av lives in the same injected sheet
    const span = document.createElement('span');
    span.className = 'ui-av';
    span.setAttribute('aria-hidden', 'true');
    span.style.background = UI.avatarColor(name);
    span.textContent = (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    return span;
};
