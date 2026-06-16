// =============================  ProjectForm.js  ============================= //
// Create or edit a project (Govtech-Admin only). If sessionStorage has
// 'EditProjectID', the form loads that project and saves an update; otherwise it
// creates a new one. The completion gate (no Complete while tickets are open) is
// enforced server-side; the error is surfaced here.

class ProjectForm extends PageBase {
    constructor() {
        super();
        this.editId = sessionStorage.getItem('EditProjectID');
        this.isEdit = !!this.editId && this.editId !== '0';
    }

    async init() {
        if (!await this.checkAuth()) return;
        try {
            SetActivePage('ProjectsMenu');
            if (typeof UserPermissions === 'function') UserPermissions();
            this._setHeading();
            await this._populateOwners();
            if (this.isEdit) await this._loadForEdit();
            this._wire();
        } catch (error) {
            if (error.message !== 'Unauthorized') {
                this.handleError('Error initializing project form');
            }
        }
    }

    _setHeading() {
        const h = document.getElementById('pf-heading');
        if (h) h.textContent = this.isEdit ? 'Edit project' : 'New project';
        const label = document.getElementById('pf-submit-label');
        if (label) label.textContent = this.isEdit ? 'Save project' : 'Create project';
    }

    async _populateOwners() {
        // The owner select has id "assignedTechName"; Dropdowns.load fills it with
        // Govtech users (UserID + name) from the references data.
        if (typeof Dropdowns !== 'undefined') {
            await Dropdowns.load('Ticket');
        }
    }

    async _loadForEdit() {
        const id = parseInt(this.editId, 10);
        const data = await API.post('Project/GetProjectDetail',
            API.authPayload({ projectId: id }));
        if (!data || !data.projectID) return;

        this._setVal('pf-name', data.projectName);
        this._setVal('pf-type', data.projectTypeID);
        this._setVal('pf-status', data.statusID);
        this._setVal('assignedTechName', data.ownerID);
        this._setVal('pf-target', this._toInputDate(data.targetDate));
        this._setVal('pf-desc', data.description);
    }

    _wire() {
        document.getElementById('pf-submit')
            ?.addEventListener('click', () => this._submit());
        document.getElementById('pf-cancel')
            ?.addEventListener('click', () => this._leave());
    }

    async _submit() {
        const name = (document.getElementById('pf-name')?.value || '').trim();
        if (!name) {
            UI.toast?.('Please enter a project name.');
            return;
        }

        const payload = {
            project: {
                projectID: this.isEdit ? parseInt(this.editId, 10) : null,
                projectName: name,
                projectTypeID: parseInt(document.getElementById('pf-type')?.value || '0', 10),
                statusID: parseInt(document.getElementById('pf-status')?.value || '0', 10),
                ownerID: parseInt(document.getElementById('assignedTechName')?.value || '0', 10),
                targetDate: document.getElementById('pf-target')?.value || null,
                description: document.getElementById('pf-desc')?.value || null
            }
        };

        if (!payload.project.ownerID) {
            UI.toast?.('Please choose an owner.');
            return;
        }

        const btn = document.getElementById('pf-submit');
        if (btn) btn.disabled = true;
        try {
            const result = await API.post('Project/SaveProject', API.authPayload(payload));
            if (result && result.isSuccess) {
                const id = result.objectID;
                sessionStorage.setItem('ProjectID', String(id));
                sessionStorage.removeItem('EditProjectID');
                Nav.toProjectDetail();
            } else {
                // Server rule (e.g. completion gate) blocked it.
                UI.toast?.(result?.error || 'Could not save the project.');
                if (btn) btn.disabled = false;
            }
        } catch (err) {
            console.error('ProjectForm._submit:', err);
            UI.toast?.('Something went wrong saving the project.');
            if (btn) btn.disabled = false;
        }
    }

    _leave() {
        sessionStorage.removeItem('EditProjectID');
        if (this.isEdit) {
            sessionStorage.setItem('ProjectID', String(this.editId));
            Nav.toProjectDetail();
        } else {
            Nav.toProjectsPage();
        }
    }

    // ---- helpers ----
    _setVal(id, v) { const el = document.getElementById(id); if (el != null && v != null) el.value = v; }
    _toInputDate(v) {
        if (!v) return '';
        const d = new Date(v);
        if (isNaN(d)) return '';
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${d.getFullYear()}-${m}-${day}`;
    }
}

// -------------------------  Init  ------------------------- //
const projectForm = new ProjectForm();
document.addEventListener('DOMContentLoaded', () => projectForm.init());
