// =============================  RFCFields.js  ============================= //
// Populates the RFC detail form from a GetChangeRequestDetail response.
// Rebuilt from the old RFCPopulator (Phase 5): made self-contained — it used to
// `extends TicketDetailPopulator`, which never actually defined the base methods
// it relied on (and was later deleted), so RFC population never ran. The missing
// base methods (_populateField / _saveAssignedTechInfo) are reconstructed here,
// and the undefined SetSelectedIndexUsingName is replaced with Form.setSelectByName.
// Exposes FillRFCDetails(data), which RFCDetails calls after the fetch.

'use strict';

class RFCPopulator {
    constructor(data) {
        this.data = data;
        this.formFields = document.getElementById('UpdateRFC')
            ?.getElementsByClassName('Value') ?? [];
    }

    // -------------------------  Public  ------------------------- //

    populate() {
        this._saveAssignedTechInfo();
        for (const field of this.formFields) {
            this._populateField(field);
        }
    }

    // -------------------------  Reconstructed base  ------------------------- //

    _populateField(field) {
        const name = this._normalizeFieldName(field.id);
        const value = this.data[name];
        if (value === undefined || value === null) return;

        if (field.tagName === 'SELECT') {
            this._handleSelectField(field, value);
        } else {
            // input + textarea both expose .value; dates handled in _handleInputField
            this._handleInputField(field, value);
        }
    }

    _saveAssignedTechInfo() {
        const select = document.getElementById('assignedTechName');
        if (!select || select.selectedIndex === -1) return;
        sessionStorage.setItem(
            STORAGE_KEYS.RFC_ASSIGNED_TECH,
            select.options[select.selectedIndex].value
        );
    }

    // -------------------------  RFC-specific  ------------------------- //

    _normalizeFieldName(fieldId) {
        // RFC fields are prefixed with 'changeRequest'
        const prefixed = `changeRequest${fieldId}`;
        if (this.data[prefixed]) return prefixed;

        // Fall back to camelCase
        if (this.data[fieldId]) return fieldId;

        // Fall back to lowercase first char
        const camel = fieldId.charAt(0).toLowerCase() + fieldId.slice(1);
        if (this.data[camel]) return camel;

        // Final fallback — return prefixed anyway
        return prefixed;
    }

    _handleSelectField(field, value) {
        if (!value || value.toString() === '0') return;
        // RFC uses name-based selection; Form.setSelectByName matches by option text.
        Form.setSelectByName(field, value);
    }

    _handleInputField(field, value) {
        if (field.type === 'date') {
            this._setDateField(field, value);
        } else {
            field.value = value;
        }
    }

    _setDateField(field, value) {
        const parts = value.split('/');
        if (parts.length !== 3) return;

        const [day, month, year] = parts;
        field.value = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
}

// -------------------------  Entry point  ------------------------- //

function FillRFCDetails(data) {
    new RFCPopulator(data).populate();
}
