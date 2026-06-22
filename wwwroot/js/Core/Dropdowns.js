// =============================  Dropdowns.js  ============================= //

const Dropdowns = {

    // Some markup ids predate the proc column names; when a response key
    // has no directly-matching element, try its legacy alias.
    _ID_ALIASES: { assignedTechName: 'assignedtech', department: 'Department', status: 'rfcStatus' },

    // -------------------------  Load  ------------------------- //

    async load(group) {
        try {
            const data = await API.post('Misc/GetDropDownList',
                API.authPayload({
                    filter: sessionStorage.getItem(STORAGE_KEYS.SEARCH_OR_TICKET) ?? '0',
                    group
                })
            );

            if (!data) return;
            this._populate(data, group);

        } catch (error) {
            console.error('Dropdown load failed:', error);
        }
    },

    // -------------------------  Populate  ------------------------- //

    _populate(data, group) {
        for (const [tableName, items] of Object.entries(data)) {
            if (!Array.isArray(items)) continue;

            const el = document.getElementById(tableName)
                ?? document.getElementById(this._ID_ALIASES[tableName] ?? '');
            if (!el) continue;

            if (el.tagName === 'SELECT') {
                this._populateSelect(el, items, group, tableName);
            } else if (el.attributes?.checkbox) {
                this._populateCheckboxGroup(el, items);
            }
        }
    },

    _populateSelect(el, items, group, tableName) {
        // Skip if already populated
        if (el.options.length > 0) return;

        for (const item of items) {
            const text = item.name ?? item.text ?? '';
            const value = item.id ?? item.value ?? '';

            // The CR / non-CR status split only applies to Ticket statuses
            // (tblStatus mixes both). RFC and Task have their own status
            // tables and must never be CR-filtered, or their dropdowns come
            // up empty.
            const skip = group === 'Ticket'
                && this._shouldSkipOption(text, tableName);

            if (!skip) {
                el.appendChild(new Option(text, value));
            }
        }

        el.selectedIndex = -1;
    },

    _populateCheckboxGroup(el, items) {
        const fragment = document.createDocumentFragment();

        for (const item of items) {
            const text = item.name ?? item.text ?? '';
            const value = item.id ?? item.value ?? '';

            const div = document.createElement('div');
            div.className = 'CheckboxDiv';
            div.id = `${text}-checkbox`;

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.id = text;
            input.value = value;

            const label = document.createElement('label');
            label.htmlFor = text;
            label.innerText = ` ${text}`;

            div.appendChild(input);
            div.appendChild(label);
            fragment.appendChild(div);
        }

        el.appendChild(fragment);
    },


    // -------------------------  CR Filter  ------------------------- //

    _shouldSkipOption(text, tableName) {
        if (tableName !== 'status') return false;

        const requestType = sessionStorage.getItem(STORAGE_KEYS.REQUEST_TYPE);
        const isCRRequest = ['4', '10', '11'].includes(requestType);
        const isCROption = text.includes('CR');

        // CR request — skip non-CR options
        // Non-CR request — skip CR options
        return isCRRequest ? !isCROption : isCROption;
    }

};


// -------------------------  Global  ------------------------- //

if (typeof window !== 'undefined') {
    window.Dropdowns = Dropdowns;
}

// -------------------------  Legacy Wrappers  ------------------------- //

function GetAllDropDownlists(userName, token, group) { Dropdowns.load(group); }
function GetRFCDropDownlists(userName, token, group) { Dropdowns.load(group); }
function HandleDropdownList(data, group) { Dropdowns._populate(data, group); }
function CRorNonCROption(text, tableName) { return Dropdowns._shouldSkipOption(text, tableName); }
