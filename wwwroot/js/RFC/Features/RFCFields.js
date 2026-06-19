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
        // After the overhaul, general-info fields live in the header panel
        // (outside #UpdateRFC); Extended Information stays in the form. Read
        // .Value document-wide so all fields populate. Save already does this.
        this.formFields = document.getElementsByClassName('Value');
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
        } else if (field.tagName === 'LABEL') {
            // Read-only display fields (e.g. Title, originator) show via text.
            // Date-valued labels (e.g. changeRequestCreateDate) arrive as ISO;
            // render them human-readable rather than showing the raw timestamp.
            field.innerText = this._formatDisplayDate(value);
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
        const raw = String(value);
        // null dates may arrive as the proc's 1900-01-01 placeholder
        // (isnull(col, '') -> datetime epoch); leave the input blank.
        if (!raw || raw.startsWith('1900-01-01')) { field.value = ''; return; }

        // Dates serialize as ISO (yyyy-MM-ddTHH:mm:ss) by default. Accept that
        // and the legacy dd/MM/yyyy form, normalising both to the yyyy-MM-dd a
        // date input requires.
        if (raw.includes('T') || /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            field.value = raw.split('T')[0];
            return;
        }
        const parts = raw.split('/');
        if (parts.length !== 3) return;
        const [day, month, year] = parts;
        field.value = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Format an ISO date string for read-only display. Non-date strings pass
    // through unchanged; the 1900-01-01 null placeholder renders blank.
    _formatDisplayDate(value) {
        const raw = String(value);
        if (!raw.includes('T') && !/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw;
        if (raw.startsWith('1900-01-01')) return '';
        const d = new Date(raw);
        if (isNaN(d)) return raw;
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
}

// -------------------------  Entry point  ------------------------- //

function FillRFCDetails(data) {
    new RFCPopulator(data).populate();
}
