// =============================  RFCSave.js  ============================= //

class RFCSave extends PageBase {
    constructor() {
        super();
        this.rfcId = sessionStorage.getItem(STORAGE_KEYS.RFC_ID)
            ?? sessionStorage.getItem(STORAGE_KEYS.TICKET_ID);
    }

    // -------------------------  Save  ------------------------- //

    async saveRFC(options = {}) {
        const {
            autoSave = false,
            visibility = true
        } = options;

        const saveButton = document.getElementById('Save-Button');
        if (!saveButton) return;

        if (!this._validateForm()) return;

        saveButton.disabled = true;
        if (!autoSave) ToggleWaiting();

        try {
            const rfcData = this._collectRFCData();
            const response = await this._submitRFC(rfcData);
            if (!response) return;

            await this._handleSaveSuccess(response, rfcData.rfcId, {
                visibility,
                autoSave
            });

        } catch (error) {
            if (error.message !== 'Unauthorized') {
                this.handleError("Error: Couldn't Save RFC", 'RFCDetails');
            }
        } finally {
            if (!autoSave) ToggleWaiting();
            saveButton.disabled = false;
        }
    }

    // -------------------------  Validation  ------------------------- //

    _validateForm() {
        const completedDate = document.getElementById('CompletedDate');
        if (!completedDate) return true;

        if (completedDate.required && !completedDate.value) {
            BuildMessageBox('Please fill in completion date');
            return false;
        }

        return true;
    }

    // -------------------------  Data Collection  ------------------------- //

    _collectRFCData() {
        const rfcId = document.getElementById('RFCID')?.innerHTML;
        if (!rfcId) throw new Error('RFC ID element not found');

        const formElements = document.getElementsByClassName('Value');
        const formData = Form.getValues(formElements, { rfcId });

        return { rfcId, formData };
    }

    async _submitRFC({ rfcId, formData }) {
        // SaveRFCRequest expects the pipe-backtick ObjectInfo format (as used
        // by SaveNote/SaveTask), not flat fields. The keys are the field
        // element ids, which is what the controller's PopulateObject maps from.
        // rfcId is sent separately (the controller adds ChangeRequestID itself).
        // Form ids that differ from the RFC model's property names (the
        // controller's PopulateObject matches keys to properties by name).
        // 'rfcStatus' is the select's id but the property is 'Status'.
        const KEY_ALIASES = { rfcStatus: 'status' };

        const objectInfo = Object.entries(formData)
            .filter(([k, v]) => k !== 'rfcId' && v !== null && v !== undefined)
            .map(([k, v]) => `${KEY_ALIASES[k] ?? k}\`${v}`)
            .join('|');

        return API.post('RFC/SaveRFC',
            API.authPayload({
                rfcId: parseInt(rfcId, 10),
                objectInfo,
                attachment: '',
                utc: Layout.getUTCOffset?.() ?? 0
            })
        );
    }

    // -------------------------  Save Success  ------------------------- //

    async _handleSaveSuccess(data, rfcId, options) {
        const { visibility, autoSave } = options;

        this._updateAssignedTechSession();
        this._saveOriginalNote(rfcId);

    }

    _updateAssignedTechSession() {
        const select = document.getElementById('assignedTechName');
        const value = select?.selectedIndex !== -1
            ? select.options[select.selectedIndex].value
            : '';
        sessionStorage.setItem(STORAGE_KEYS.NEW_ASSIGNED_TECH, value);
    }

    _saveOriginalNote(rfcId) {
        const description = document.getElementById('Description');
        if (!description?.name) return;

        SaveOriginalNote(
            description.getAttribute('name'),
            true,
            description.value,
            rfcId
        );
    }
}

// -------------------------  Legacy Wrapper  ------------------------- //

const rfcSave = new RFCSave();

function SaveRFC(autoSave, visibility) {
    rfcSave.saveRFC({ autoSave, visibility });
}
