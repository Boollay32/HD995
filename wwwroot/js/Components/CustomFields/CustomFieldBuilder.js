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

        // On the ticket DETAIL page the overview panel at the top already
        // shows Authority, the assigned client, and the needed-by/target date.
        // Don't repeat those in the Extended Information section below.
        // (The create form, #Custom-fields, still needs them.)
        const isDetail = customDiv.id === 'CustomFields-Container';
        const OVERVIEW_FIELDS = new Set(['Authority', 'assignedClientID', 'targetDate', 'neededBy']);
        // Guard against the same customFilterItem arriving twice: two controls
        // sharing an id is invalid markup and makes the save serialize a duplicate
        // key (the "Webform" crash). Case-insensitive to match TicketMapper's
        // OrdinalIgnoreCase parse. Overview fields are still dropped on detail.
        const seen = new Set();
        const fields = data.filter(f => {
            if (isDetail && OVERVIEW_FIELDS.has(f.customFilterItem)) return false;
            const key = (f.customFilterItem || '').toLowerCase();
            if (key && seen.has(key)) return false;
            if (key) seen.add(key);
            return true;
        });

        // Clear any previously-built rows (class .Detail-Div, scoped to this
        // container) before rebuilding.
        for (const el of customDiv.querySelectorAll('.Detail-Div')) {
            el.remove();
        }

        for (const fieldConfig of fields) {
            this._buildCustomField(fieldConfig, customDiv);
        }

        // Populate saved values, if supplied. Each field element id ===
        // customFilterItem, which matches the serialized ticket field name
        // (camelCase), so values[id] is the saved value for that field.
        if (values) this._applyCustomValues(fields, values);
    }

    // Set the saved value into each built custom field. Handles inputs,
    // textareas, selects (best-effort: only if the option exists), checkboxes,
    // and date inputs (trim the time part).
    _applyCustomValues(configs, values) {
        // Saved values are mapped onto the Ticket model case-insensitively;
        // the response can echo keys back in a different case than the field's
        // customFilterItem. Match case-insensitively so every field repopulates
        // (HD40 3a), not just the ones whose casing happens to line up.
        const byLower = {};
        for (const k in values) byLower[k.toLowerCase()] = values[k];
        for (const cfg of configs) {
            const id = cfg.customFilterItem;
            if (!id) continue;
            const el = document.getElementById(id);
            if (!el) continue;
            let v = byLower[id.toLowerCase()];
            if (v === undefined || v === null) continue;
            v = String(v);

            if (el.tagName === 'SELECT') {
                const opt = [...el.options].find(o => o.value === v);
                if (opt) el.value = v;
            } else if (el.tagName === 'INPUT' && el.type === 'checkbox') {
                el.checked = (v === '1' || v.toLowerCase() === 'true');
            } else if (el.tagName === 'INPUT' && el.type === 'date') {
                // 1900-01-01 is the proc's null-date placeholder
                // (isnull(col, '') -> datetime epoch); leave the input blank.
                el.value = v.startsWith('1900-01-01') ? '' : v.split('T')[0];
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

        if (config.customFilterItem === 'Authority') {
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

// -------------------------  Contact Client  ------------------------- //

// When the contact-client Authority dropdown changes, pull that authority's
// users and fill the assigned-client dropdown (id="assignedClientID") with
// their email addresses.
async function FindClients(authoritySelect) {
    const clientSelect = document.getElementById('assignedClientID');
    if (!clientSelect) return;

    const authorityId = parseInt(authoritySelect?.value, 10);
    clientSelect.innerHTML = '';

    const placeholder = (text) => {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = text;
        opt.disabled = true;
        opt.selected = true;
        clientSelect.appendChild(opt);
    };

    if (!authorityId) { placeholder('Select an authority first'); return; }

    try {
        const clients = await API.post('User/GetAuthorityClients',
            API.authPayload({ authorityId }));
        const list = Array.isArray(clients) ? clients : [];
        if (!list.length) { placeholder('No clients found'); return; }

        placeholder('Select a client');
        for (const c of list) {
            const opt = document.createElement('option');
            opt.value = c.userID ?? '';
            opt.textContent = c.email || c.userName || ('User ' + (c.userID ?? ''));
            clientSelect.appendChild(opt);
        }
    } catch (err) {
        console.error('FindClients:', err);
        placeholder('Could not load clients');
    }
}

// -------------------------  Global  ------------------------- //

if (typeof window !== 'undefined') {
    window.customFieldBuilder = customFieldBuilder;
    window.ChangeCustomFields = ChangeCustomFields;
    window.FindClients = FindClients;
}
