// =============================  CustomFieldBuilder.js  ============================= //

class CustomFieldBuilder {

    constructor() {
        this.fieldTypeHandlers = {
            'Select': config => this._createSelectField(config),
            'checkbox': config => this._createCheckboxField(config),
            'Input': config => this._createInputField(config),
            'textarea': config => this._createTextareaField(config)
        };
    }

    // -------------------------  Public  ------------------------- //

    async changeCustomFields(requestId, values) {
        const id = requestId ?? this._extractRequestIdFromDOM();
        if (!id) return;

        const data = await API.post('Ticket/ChangeCustomFields',
            API.authPayload({ requestId: parseInt(id) })
        );

        if (data) this._buildCustomFields(data, values);
    }

    // -------------------------  Build  ------------------------- //

    _buildCustomFields(data, values) {
        // The custom-field container differs per page: CreateTicket uses
        // #Custom-fields, TicketDetails uses #CustomFields-Container.
        const customDiv = document.querySelector('#Custom-fields')
            || document.querySelector('#CustomFields-Container');
        if (!customDiv) return;

        // Clear any previously-built rows (class .Detail-Div, scoped to this
        // container) before rebuilding.
        for (const el of customDiv.querySelectorAll('.Detail-Div')) {
            el.remove();
        }

        for (const fieldConfig of data) {
            this._buildCustomField(fieldConfig, customDiv);
        }

        // Populate saved values, if supplied. Each field element id ===
        // customFilterItem, which matches the serialized ticket field name
        // (camelCase), so values[id] is the saved value for that field.
        if (values) this._applyCustomValues(data, values);
    }

    // Set the saved value into each built custom field. Handles inputs,
    // textareas, selects (best-effort: only if the option exists), checkboxes,
    // and date inputs (trim the time part).
    _applyCustomValues(configs, values) {
        for (const cfg of configs) {
            const id = cfg.customFilterItem;
            if (!id) continue;
            const el = document.getElementById(id);
            if (!el) continue;
            let v = values[id];
            if (v === undefined || v === null) continue;
            v = String(v);

            if (el.tagName === 'SELECT') {
                const opt = [...el.options].find(o => o.value === v);
                if (opt) el.value = v;
            } else if (el.tagName === 'INPUT' && el.type === 'checkbox') {
                el.checked = (v === '1' || v.toLowerCase() === 'true');
            } else if (el.tagName === 'INPUT' && el.type === 'date') {
                el.value = v.split('T')[0];
            } else if ('value' in el) {
                el.value = v;
            }
        }
    }

    _buildCustomField(fieldConfig, customDiv) {
        const detailDiv = this._createDetailDiv(fieldConfig);
        customDiv.appendChild(detailDiv);

        if (fieldConfig.customFilterObjectType === 'checkbox') {
            document.getElementById(fieldConfig.customFilterItem)
                ?.setAttribute('CheckBox', 'true');
        }
    }

    // -------------------------  DOM Creation  ------------------------- //

    _createDetailDiv(fieldConfig) {
        const outer = document.createElement('div');
        outer.className = 'Detail-Div full';   // class, not a duplicated id per row

        const leftDiv = document.createElement('div');
        leftDiv.className = 'left';

        const label = document.createElement('label');
        label.className = 'Name';
        label.innerText = fieldConfig.customFilterName ?? '';  // innerText — XSS safe

        leftDiv.appendChild(label);

        const rightDiv = document.createElement('div');
        rightDiv.className = 'right';
        rightDiv.appendChild(this._createFieldElement(fieldConfig));

        outer.appendChild(leftDiv);
        outer.appendChild(rightDiv);

        return outer;
    }

    _createFieldElement(fieldConfig) {
        const handler = this.fieldTypeHandlers[fieldConfig.customFilterObjectType]
            ?? (config => this._createDefaultField(config));
        return handler(fieldConfig);
    }

    // -------------------------  Field Creators  ------------------------- //

    _createSelectField(config) {
        const select = document.createElement('select');
        select.className = 'Value';
        select.id = config.customFilterItem;

        if (config.customFilterItem === 'authorityName') {
            select.addEventListener('change', function () {
                FindClients(this);
            });
        }

        return select;
    }

    _createCheckboxField(config) {
        const div = document.createElement('div');
        div.className = 'Value';
        div.id = config.customFilterItem;
        return div;
    }

    _createInputField(config) {
        const input = document.createElement('input');
        input.className = 'Value';
        input.id = config.customFilterItem;

        if (config.customFilterDataType === 'date') {
            input.type = 'date';
        }

        return input;
    }

    _createTextareaField(config) {
        const textarea = document.createElement('textarea');
        textarea.className = 'Value';
        textarea.id = config.customFilterItem;
        textarea.addEventListener('input', function () {
            UI.autoGrow(this);
        });
        return textarea;
    }

    _createDefaultField(config) {
        // Whitelist safe element types — prevents XSS via customFilterObjectType
        const SAFE_TYPES = ['input', 'select', 'textarea', 'div', 'span'];
        const type = SAFE_TYPES.includes(config.customFilterObjectType?.toLowerCase())
            ? config.customFilterObjectType
            : 'div';

        const el = document.createElement(type);
        el.className = 'Value';
        el.id = config.customFilterItem;
        return el;
    }

    // -------------------------  Helpers  ------------------------- //

    _extractRequestIdFromDOM() {
        return document.getElementById('RequestDescription')
            ?.getAttribute(STORAGE_KEYS.REQUEST_TYPE) ?? null;
    }
}

// -------------------------  Singleton  ------------------------- //

const customFieldBuilder = new CustomFieldBuilder();

// -------------------------  Legacy Wrapper  ------------------------- //

function ChangeCustomFields(requestId) {
    customFieldBuilder.changeCustomFields(requestId);
}

// -------------------------  Global  ------------------------- //

if (typeof window !== 'undefined') {
    window.customFieldBuilder = customFieldBuilder;
    window.ChangeCustomFields = ChangeCustomFields;
}
