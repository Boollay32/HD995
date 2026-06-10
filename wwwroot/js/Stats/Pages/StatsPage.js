// =============================  StatsPage.js  ============================= //

class StatsPage extends PageBase {
    constructor() {
        super();
    }

    // -------------------------  Init  ------------------------- //

    async init() {
        if (!await this.checkAuth()) return;
        try {
            this._setupPageUI();
            this._setupEventListeners();
        } catch (error) {
            if (error.message !== 'Unauthorized') {
                this.handleError('Error initializing stats page');
            }
        }
    }

    // -------------------------  Page UI  ------------------------- //

    _setupPageUI() {
        SetActivePage('StatsMenu');
        UserPermissions();
        ChooseSeason();
        DisplayScreen();
    }

    // -------------------------  Event Listeners  ------------------------- //

    _setupEventListeners() {
        // Fix: single listener for all stat buttons via data attributes
        document.querySelectorAll('.st-report-btn[data-stat-type]')
            .forEach(btn => btn.addEventListener('click', () => {
                const type = parseInt(btn.dataset.statType);
                const label = btn.dataset.statLabel;
                this._setActive(btn);
                this.getStats(type, label, btn.textContent.trim());
            }));

        // Fix: download button wired here — not onclick=""
        document.getElementById('Download-Table-Button')
            ?.addEventListener('click', () => this._triggerDownload());

    }

    // -------------------------  Stats  ------------------------- //

    async getStats(statsId, reportName, title = reportName) {
        try {
            const data = await API.post('Reports/GetStats',
                API.authPayload({ statsId })
            );

            this._showResult(title, data?.length ?? 0);
            if (!data?.length) return;

            CreateDynamicTable(data, 'Stats', null, null);
            this._createCSV(data, reportName);

        } catch (error) {
            if (error.message !== 'Unauthorized') {
                this.handleError("Error: Couldn't load stats.");
            }
        }
    }

    // -------------------------  Result chrome  ------------------------- //

    _setActive(btn) {
        document.querySelectorAll('.st-report-btn.is-active')
            .forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
    }

    _showResult(title, rowCount) {
        const titleEl = document.getElementById('Stat-Title');
        const countEl = document.getElementById('Stat-Count');
        const emptyEl = document.getElementById('Stat-Empty');
        const tableEl = document.getElementById('Table-Div-Outer');

        if (titleEl) titleEl.textContent = title;
        if (countEl) countEl.textContent = rowCount ? `${rowCount} row${rowCount === 1 ? '' : 's'}` : 'No data';
        if (emptyEl) emptyEl.hidden = rowCount > 0;
        if (tableEl) tableEl.hidden = rowCount === 0;
    }

    // -------------------------  CSV  ------------------------- //

    _createCSV(data, reportName) {
        const { headers, rows } = this._buildCSVContent(data);
        const csv = `${headers}\n${rows}`;
        const blob = new Blob([csv], { type: 'text/csv' });
        const blobURL = URL.createObjectURL(blob);

        this._renderDownloadLink(blobURL, reportName);
    }

    _buildCSVContent(data) {
        // Fix: CSV escaping — values with commas/quotes/newlines wrapped in quotes
        const escapeCSV = val => {
            const str = String(val ?? '');
            return str.includes(',') || str.includes('"') || str.includes('\n')
                ? `"${str.replace(/"/g, '""')}"`
                : str;
        };

        let headers = '';
        let rows = '';

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const keys = Object.keys(row);

            if (i === 0) headers = keys.join(',');

            rows += keys.map(key => escapeCSV(row[key])).join(',') + '\n';
        }

        return { headers, rows };
    }

    _renderDownloadLink(blobURL, reportName) {
        // Fix: id selector — name selector removed from view
        // Fix: blob URL revoked after download — prevents memory leak
        const btn = document.getElementById('Download-Table-Button');
        if (!btn) return;
        btn.disabled = false;

        btn.onclick = () => {
            const link = document.createElement('a');
            link.href = blobURL;
            link.download = `${reportName}HelpdeskReport.csv`;
            link.click();
            URL.revokeObjectURL(blobURL);  // Fix: memory leak prevented
        };
    }
}

// -------------------------  Init  ------------------------- //

const statsPage = new StatsPage();
document.addEventListener('DOMContentLoaded', () => statsPage.init());

// -------------------------  Legacy Wrappers  ------------------------- //

function GetStats(statsId, reportName) { statsPage.getStats(statsId, reportName); }
function CreateCSVFromTable(data, reportName) { statsPage._createCSV(data, reportName); }
