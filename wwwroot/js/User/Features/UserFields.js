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
