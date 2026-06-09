// =============================  UserFields.js  ============================= //
// Populates the user detail form from a User/GetUserDetail response.
// Extracted from UserDetails (Phase 6). Fixes the Form.setSelectedByName typo
// (the real Core/Form.js method is setSelectByName), which previously stopped
// SELECT fields from populating. Exposes FillUserDetail(details).

'use strict';

function FillUserDetail(details) {
    const userNameEl = document.getElementById(STORAGE_KEYS.USER_NAME);
    if (userNameEl) userNameEl.innerText = details.userName ?? '';

    for (const [key, value] of Object.entries(details)) {
        if (!value && value !== 0) continue;

        const elementId = key.charAt(0).toUpperCase() + key.slice(1);
        const el = document.getElementById(elementId);
        if (!el) continue;

        _fillUserElement(el, value);
    }

    _setUserAvatar(details.userName);
    _setUserRole(details.adminLevel);
    _setUserStatusPill(details.locked);
}

function _fillUserElement(el, value) {
    const strValue = String(value);

    switch (el.nodeName) {
        case 'INPUT':
            el.value = strValue;
            break;
        case 'SELECT':
            Form.setSelectByName(el, strValue);   // Fix: was Form.setSelectedByName (undefined)
            break;
        case 'LABEL':
            el.innerText = strValue;
            break;
        default:
            el.innerText = strValue;
            break;
    }
}

// -------------------------  Modern header derivations  ------------------------- //
// Avatar initials, hero role line, and the lock-derived status pill are not part
// of the GetUserDetail payload; they are computed from the loaded user here.

function _setUserAvatar(name) {
    const el = document.getElementById('User-Avatar');
    if (!el) return;
    const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
    const initials = parts.slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('');
    el.innerText = initials || '?';
}

function _setUserRole(adminLevel) {
    const el = document.getElementById('User-Role');
    if (el) el.innerText = adminLevel ?? '';
}

function _setUserStatusPill(locked) {
    const pill = document.getElementById('User-Status-Pill');
    const text = document.getElementById('User-Status-Text');
    if (!pill || !text) return;

    const isLocked = String(locked) === '1';
    text.innerText = isLocked ? 'Locked' : 'Active';
    pill.classList.toggle('ud-pill--ok', !isLocked);
    pill.classList.toggle('ud-pill--bad', isLocked);
}
