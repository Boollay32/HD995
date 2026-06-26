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
        // Hidden elements report scrollHeight 0; sizing them would bake in
        // an inline height of 0px that survives until the next input event
        // (which a 0-height box can never receive). Leave them at 'auto'.
        if (element.scrollHeight === 0) return;
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
    UI._drainFlash();
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
    el.setAttribute('tabindex', '-1');
    el.textContent = message;
    host.appendChild(el);

    // Remember where focus was, then move it onto the toast so a screen
    // reader lands on the notice and reads it. If focus is already on an
    // earlier toast, chain back to that one's origin so focus returns to the
    // real control. Focus is handed back when this toast leaves (dismiss()).
    const active = document.activeElement;
    const fromToast = active && active.closest ? active.closest('.ui-toast') : null;
    const origin = fromToast ? fromToast._returnFocus : active;
    el._returnFocus = (origin && origin.isConnected && origin !== document.body) ? origin : null;

    // Dwell scales with reading length (5s min, 10s cap) so there's time to
    // read it; the timer pauses on hover or on deliberate (user) focus.
    const words = String(message).trim().split(/\s+/).filter(Boolean).length;
    const lifeMs = Math.min(10000, Math.max(5000, 2600 + words * 700));
    let timer = null, done = false;
    const dismiss = () => {
        if (done) return;
        done = true;
        if (timer) { clearTimeout(timer); timer = null; }
        el.classList.remove('is-in');
        const back = el._returnFocus;
        setTimeout(() => {
            el.remove();
            if (back && back.isConnected && typeof back.focus === 'function') {
                try { back.focus({ preventScroll: true }); } catch (_) {}
            }
        }, 260);
    };
    const arm  = () => { if (!done && timer === null) timer = setTimeout(dismiss, lifeMs); };
    const hold = () => { if (timer) { clearTimeout(timer); timer = null; } };

    el.addEventListener('mouseenter', hold);
    el.addEventListener('mouseleave', arm);
    // Our own programmatic focus must not pause the timer (an untouched toast
    // would then never leave); only a user tabbing in should hold it open.
    let selfFocus = false;
    el.addEventListener('focusin',  () => { if (!selfFocus) hold(); });
    el.addEventListener('focusout', arm);
    el.addEventListener('click', dismiss);
    el.addEventListener('keydown', e => { if (e.key === 'Escape') dismiss(); });

    requestAnimationFrame(() => {
        el.classList.add('is-in');
        selfFocus = true;
        try { el.focus({ preventScroll: true }); } catch (_) { try { el.focus(); } catch (_) {} }
        selfFocus = false;
    });

    arm();
};

// Cross-navigation flash: stash a message now, surface it as a toast on the
// next page load. Used by create flows that navigate to a list. Drained in
// the DOMContentLoaded handler below.
UI.flash = function (message, type = 'info') {
    try { sessionStorage.setItem('ui-flash', JSON.stringify({ message, type })); } catch (_) {}
};

UI._drainFlash = function () {
    let raw = null;
    try { raw = sessionStorage.getItem('ui-flash'); } catch (_) { return; }
    if (!raw) return;
    try { sessionStorage.removeItem('ui-flash'); } catch (_) {}
    let data; try { data = JSON.parse(raw); } catch (_) { return; }
    if (data && data.message) UI.toast(data.message, data.type || 'info');
};

UI._ensureToastStyles = function () {
    if (document.getElementById('ui-toast-styles')) return;
    const s = document.createElement('style');
    s.id = 'ui-toast-styles';
    s.textContent = `
#ui-toast-host { position: fixed; top: 16px; right: 16px;
  display: flex; flex-direction: column; align-items: flex-end; gap: 8px; z-index: 4000; pointer-events: none; }
.ui-toast { font-family: 'Spline Sans', system-ui, sans-serif; font-size: 0.84375rem; font-weight: 500;
  background: var(--panel, #fff); color: var(--text, #1D1C1A);
  border: 1px solid var(--border, #D8D3C8); border-left-width: 4px; border-radius: 9px;
  padding: 10px 16px; box-shadow: 0 6px 22px rgba(0,0,0,0.18);
  opacity: 0; transform: translateY(-10px); transition: opacity .25s ease, transform .25s ease;
  pointer-events: auto; cursor: default; }
.ui-toast.is-in { opacity: 1; transform: translateY(0); }
.ui-toast--success { border-color: var(--ok, #2e7d32); background: var(--ok-bg, #D7EDE9); }
.ui-toast--error   { border-left-color: var(--danger, #c62828); }
.ui-toast--warning { border-left-color: var(--warn, #ed6c02); }
.ui-toast--info    { border-left-color: var(--info, #0277bd); }
.ui-toast:focus { outline: 2px solid var(--accent, #B5530E); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .ui-toast { transition: opacity .15s ease; transform: none; }
  .ui-toast.is-in { transform: none; }
}
.ui-av { display: inline-flex; align-items: center; justify-content: center;
  width: 18px; height: 18px; border-radius: 50%; margin-right: 6px; flex: none;
  font-family: 'Spline Sans', system-ui, sans-serif; font-size: 0.59375rem; font-weight: 700;
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
