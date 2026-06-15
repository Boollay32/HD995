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

    // The generic loop above sets selects by option TEXT, but the detail
    // payload's adminLevel/locked values never equal the option labels --
    // set the two selects explicitly with tolerant matching.
    _setSelectSmart('AdminLevel', details.adminLevel);
    _setSelectSmart('Locked', Number(details.locked) === 1 ? '1' : '0');

    _setUserAvatar(details.userName);
    _setUserRole(details.adminLevel);
    _setUserStatusPill(details.locked);
}

// Select the option matching by VALUE first, then exact text, then a known
// label alias. Unmatched values are logged so the real payload shape
// surfaces instead of failing silently.
const _ADMIN_LABEL_ALIASES = {
    'user': '0', 'authority': '0', 'authority user': '0',
    'govtech': '1', 'govtech user': '1',
    'govtech admin': '2', 'govtech admin user': '2',
    'tns': '3', 'tns user': '3',
    'govtech rfc': '4', 'govtech rfc user': '4',
    'govtech tns': '5', 'govtech tns user': '5',
};

function _setSelectSmart(id, value) {
    const el = document.getElementById(id);
    if (!el || value === null || value === undefined || value === '') return;

    let str = String(value).trim();
    // Normalise numeric-ish values so 1, '1', '2.0' match option values.
    if (/^-?\d+(\.0+)?$/.test(str)) str = String(parseInt(str, 10));
    const byValue = [...el.options].find(o => o.value === str);
    if (byValue) { el.value = byValue.value; return; }

    const lower = str.toLowerCase();
    const byText = [...el.options].find(o => o.innerText.trim().toLowerCase() === lower);
    if (byText) { el.value = byText.value; return; }

    const alias = _ADMIN_LABEL_ALIASES[lower];
    if (alias !== undefined && [...el.options].some(o => o.value === alias)) {
        el.value = alias;
        return;
    }

    console.warn(`UserFields: no option in #${id} matches`, value);
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

    const l = Number(locked) || 0;
    text.innerText = l === 99 ? 'Deactivated' : (l ? 'Locked' : 'Active');
    pill.classList.toggle('ud-pill--ok', l === 0);
    pill.classList.toggle('ud-pill--bad', l !== 0 && l !== 99);
}
