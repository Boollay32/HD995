#!/usr/bin/env python3
"""
HD995 — CreateRFC full rebuild on the modern create-app shell + retirement of
the legacy three-file attachment system.

THE BUG THIS ALSO FIXES: CreateRFC called SaveOriginalNote(null, true, ...) --
files collected by the legacy plus-icon/bin UI were NEVER submitted. The new
Composer-style uploader passes this.files, so RFC attachments actually save
for the first time.

Rebuild (mirrors the New Ticket page):
  - header strip: "New RFC" + Submit button (id SubmitCreatedRFC kept)
  - LEFT panel "General information": Title, Priority, Status, Assigned To,
    Target Date, Environment, Approved By, Approval Date (2-col grid)
  - RIGHT panel "Assessment details" (in-between surface, the page's only
    scrollbar): Description + the six assessment textareas + attachments
    (dashed drop target, 5-cap, square icon tiles like the rest of the site)
  - every field id, class="Value", and required attribute preserved exactly;
    Dropdowns.load('RFC'), gateSubmit, validate, SaveRFC payload, success
    email + redirect all unchanged

Retirement (verified zero remaining consumers after this rebuild):
  - _Layout: the AttachmentFiles/AttachmentUI/Attachments script tags removed
  - deleted: wwwroot/js/Components/Attachments/{AttachmentFiles,AttachmentUI,
    Attachments}.js and wwwroot/css/Pages/CreateForm.css (CreateRFC-only)
  - Attachment.css / NotesTable.css / FormLayout.css / DetailForm.css are KEPT
    (other pages still link them); CreateRFC just stops linking them

Files:
  Views/Page/RFC/CreateRFC.cshtml        REPLACED  (BOM, CRLF)
  wwwroot/css/Pages/CreateRFC.css        NEW       (LF)
  wwwroot/js/RFC/Pages/CreateRFC.js      REPLACED  (CRLF, no BOM)
  Views/Shared/_Layout.cshtml            edited    (CRLF)
  + 4 file deletions

NOTE: Razor cannot be type-checked offline -- run `dotnet build` to confirm.

Idempotent. Usage:  python3 apply_createrfc_rebuild.py [repo_root]  (default '.')
"""

import os
import sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else '.'
VIEW   = os.path.join(ROOT, 'Views', 'Page', 'RFC', 'CreateRFC.cshtml')
CSS    = os.path.join(ROOT, 'wwwroot', 'css', 'Pages', 'CreateRFC.css')
JS     = os.path.join(ROOT, 'wwwroot', 'js', 'RFC', 'Pages', 'CreateRFC.js')
LAYOUT = os.path.join(ROOT, 'Views', 'Shared', '_Layout.cshtml')
DELETE = [
    os.path.join(ROOT, 'wwwroot', 'js', 'Components', 'Attachments', 'AttachmentFiles.js'),
    os.path.join(ROOT, 'wwwroot', 'js', 'Components', 'Attachments', 'AttachmentUI.js'),
    os.path.join(ROOT, 'wwwroot', 'js', 'Components', 'Attachments', 'Attachments.js'),
    os.path.join(ROOT, 'wwwroot', 'css', 'Pages', 'CreateForm.css'),
]

# ---------------------------------------------------------------- view ----
def field(label, fid, control):
    return (
        f'                        <div class="Detail-Div">\n'
        f'                            <div class="left"><label class="Name" for="{fid}">{label}</label></div>\n'
        f'                            <div class="right">{control}</div>\n'
        f'                        </div>\n'
    )

def area(label, fid, maxlen=1000):
    return field(label, fid,
        f'<textarea required maxlength="{maxlen}" id="{fid}" class="Value"></textarea>')

CSHTML = (
'''@{
    Layout = "~/Views/Shared/_Layout.cshtml";
    ViewData["Title"] = "New RFC";
}

@section AddCSSToHead {
    <link rel="stylesheet" type="text/css" href="/css/Addons/Snow.css" asp-append-version="true">
    <link rel="stylesheet" type="text/css" href="/css/Addons/PopupWindows.css" asp-append-version="true">
    <link rel="stylesheet" type="text/css" href="/css/Pages/CreateRFC.css" asp-append-version="true">
}

@section AddJSToHead {
    <script src="~/js/RFC/Pages/CreateRFC.js" asp-append-version="true"></script>
}

<div id="Main-Div" class="create-app">

    <header class="ca-head">
        <h1>New RFC</h1>
        <button type="button" id="SubmitCreatedRFC" class="ca-btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Submit RFC</span>
        </button>
    </header>

    <form id="create-rfc" class="ca-body">

        <section class="ca-panel">
            <header class="ca-panel-head"><h2>General information</h2></header>
            <div class="ca-panel-body">
                <div class="ca-grid">

                    <div class="Detail-Div full">
                        <div class="left"><label class="Name" for="Title">Title</label></div>
                        <div class="right"><input required maxlength="250" id="Title" class="Value" /></div>
                    </div>

'''
+ field('Priority', 'Priority',
        '<select required id="Priority" class="Value">'
        '<option value="1">Emergency</option><option value="2">High</option>'
        '<option value="3">Medium</option><option value="4">Low</option></select>')
+ field('Status', 'Status',
        '<select required id="Status" class="Value">'
        '<option value="1">Draft</option><option value="2">New</option>'
        '<option value="3">Approved</option><option value="4">Rejected</option>'
        '<option value="5">Approved with condition</option><option value="6">Incomplete</option>'
        '<option value="7">Complete</option><option value="8">In Progress</option></select>')
+ field('Assigned To', 'assignedTechName', '<select id="assignedTechName" class="Value"></select>')
+ field('Target Date', 'TargetDate', '<input required type="date" id="TargetDate" class="Value" />')
+ field('Environment', 'Environment',
        '<select required id="Environment" class="Value">'
        '<option value="1">Live</option><option value="2">Test</option>'
        '<option value="3">Live and Test</option></select>')
+ field('Approved By', 'ApprovedBy', '<input id="ApprovedBy" class="Value">')
+ field('Approval Date', 'ApprovalDate', '<input type="date" id="ApprovalDate" class="Value">')
+ '''
                </div>
            </div>
        </section>

        <section class="ca-panel ca-panel--custom">
            <header class="ca-panel-head"><h2>Assessment details</h2></header>
            <div class="ca-panel-body">

'''
+ area('Description', 'Description')
+ area('Affected Business Systems or Services', 'AffectedBusinessSystemsOrServices')
+ area('Affected Customers', 'AffectedCustomers', 250)
+ area('Business Justification', 'BusinessJustification')
+ area('Risk Assessment', 'RiskAssessment')
+ area('Impact Analysis', 'ImpactAnalysis')
+ area('Information Security Considerations', 'InformationSecurityConsiderations')
+ '''
                <div class="Detail-Div full">
                    <div class="left"><label class="Name">Attachments</label></div>
                    <div id="AttachBin" role="button" tabindex="0"
                         aria-label="Add attachments (drag and drop or click to browse)">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>
                        <span>Drag &amp; drop files or click to browse</span>
                    </div>
                    <input type="file" id="cr-file-input" multiple hidden />
                    <div id="cr-attachment-list"></div>
                </div>

            </div>
        </section>

    </form>

</div>

<div id="Display-Div"></div>
''')

# ---------------------------------------------------------------- css ----
NEW_CSS = '''/* ============================================================================
   CreateRFC.css -- New RFC page on the app's modern shell.
   Header strip + two panels; only Assessment details scrolls.
   Light and dark come straight from tokens.css.
   ============================================================================ */

#Main-Div.create-app {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: calc(100vh - 56px);
  padding: 16px;
  box-sizing: border-box;
  background: var(--canvas);
  font-family: var(--font-sans);
  color: var(--text);
}

/* ---- Header strip ---- */
.ca-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px 16px;
}
.ca-head h1 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.ca-btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 600;
  color: var(--on-accent);
  background: var(--accent);
  border: none;
  border-radius: 9px;
  padding: 8px 14px;
  cursor: pointer;
  transition: background .12s ease, opacity .12s ease;
}
.ca-btn-primary:hover { background: var(--accent-strong); }
.ca-btn-primary:disabled { opacity: .55; cursor: wait; }

/* ---- Body: two panels ---- */
.ca-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 16px;
  margin: 0;
}
.ca-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}
.ca-panel-head {
  padding: 11px 14px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.ca-panel-head h2 {
  margin: 0;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: .05em;
  text-transform: uppercase;
  color: var(--muted);
}
.ca-panel-body {
  flex: 1;
  min-height: 0;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
/* General info scrolls if it must; Assessment details is the main scroller. */
.ca-panel .ca-panel-body { overflow-y: auto; }

/* Assessment panel: in-between surface so it reads as a form sub-section. */
.ca-panel--custom,
.ca-panel--custom .ca-panel-head {
  background: var(--row-hover);
}

/* ---- Fields ---- */
.ca-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 16px;
}
.create-app .Detail-Div {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.create-app .Detail-Div.full { grid-column: 1 / -1; }
.create-app .Detail-Div .left .Name {
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: .03em;
  text-transform: uppercase;
  color: var(--muted);
}
.create-app .Detail-Div .right { width: 100%; }
.create-app .Value {
  width: 100%;
  box-sizing: border-box;
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--text);
  background: var(--canvas);
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  padding: 7px 9px;
  margin: 0;                     /* Template.css gives inputs margin-bottom */
  outline: none;
  transition: border-color .12s ease;
}
.create-app .Value:focus { border-color: var(--accent); }
.create-app .ca-panel--custom .Value { background: var(--panel); }
.create-app textarea.Value {
  min-height: 64px;
  max-height: 200px;
  overflow-y: auto;
  resize: none;
  line-height: 1.5;
}

/* ---- Attachments: drop target + square icon tiles ---- */
.create-app #AttachBin {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px;
  font-size: 12.5px;
  color: var(--muted);
  border: 1.5px dashed var(--border);
  border-radius: 10px;
  cursor: pointer;
  transition: border-color .12s ease, color .12s ease, background .12s ease;
}
.create-app #AttachBin:hover,
.create-app #AttachBin.is-dragover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--panel);
}
.create-app #cr-attachment-list {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 6px;
  padding-top: 8px;
}
.create-app #cr-attachment-list:empty { padding-top: 0; }
.ct-att-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 30px;
  max-width: 30px;
  height: 30px;
  padding: 0;
  justify-content: center;
  overflow: hidden;
  font-family: var(--font-sans);
  font-size: 12.5px;
  color: var(--text);
  background: var(--row-hover);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: default;
  transition: max-width 0.18s ease, background 0.15s ease;
}
.ct-att-icon {
  flex-shrink: 0;
  display: inline-flex;
  font-size: 13px;
  line-height: 1;
}
.ct-att-name {
  max-width: 0;
  opacity: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: max-width 0.18s ease, opacity 0.12s ease;
}
.ct-att-chip > button { display: none; flex-shrink: 0; }
.ct-att-chip:hover,
.ct-att-chip:focus-within {
  max-width: 280px;
  padding: 0 8px;
  justify-content: flex-start;
  background: var(--panel);
}
.ct-att-chip:hover .ct-att-name,
.ct-att-chip:focus-within .ct-att-name {
  max-width: 200px;
  opacity: 1;
}
.ct-att-chip:hover > button,
.ct-att-chip:focus-within > button { display: inline-flex; }
.ct-att-remove {
  border: none;
  background: var(--row-hover);
  color: var(--muted);
  width: 18px;
  height: 18px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.ct-att-remove:hover {
  background: var(--danger);
  color: var(--on-accent);
}
@media (prefers-reduced-motion: reduce) {
  .ct-att-chip,
  .ct-att-chip .ct-att-name { transition: none; }
}

/* ---- Narrow screens: stack and give the page its scroll back ---- */
@media (max-width: 900px) {
  #Main-Div.create-app {
    height: auto;
    min-height: calc(100vh - 56px);
  }
  .ca-body { grid-template-columns: 1fr; }
  .ca-panel .ca-panel-body { overflow-y: visible; }
}
'''

# ---------------------------------------------------------------- js ----
NEW_JS = '''// =============================  CreateRFC.js  ============================= //
// New RFC page on the modern create-app shell. Composer-style attachments:
// files are kept on this.files and passed to SaveOriginalNote, which encodes
// them via Composer.encode -- previously null was passed, so RFC attachments
// were silently dropped.

class CreateRFC extends PageBase {
    constructor() {
        super();
        this.formId = 'create-rfc';
        this.files = [];
    }

    // -------------------------  Init  ------------------------- //

    async init() {
        if (!await this.checkAuth()) return;
        try {
            await Promise.all([
                this.waitForElement(this.formId),
                Dropdowns.load('RFC')
            ]);

            this._setupPageUI();
            this._setupEventListeners();

        } catch (error) {
            this.handleError('Error initializing create RFC');
        }
    }

    // -------------------------  Page UI  ------------------------- //

    _setupPageUI() {
        SetActivePage('RFCMenu');
        UserPermissions();
        ChooseSeason();
        DisplayScreen();
        ClearAllFormInputs(this.formId);
        SetTargetDateMinToday();
    }

    // -------------------------  Event Listeners  ------------------------- //

    _setupEventListeners() {
        document.getElementById('SubmitCreatedRFC')
            ?.addEventListener('click', () => this.submitRFC());
        Form.gateSubmit(this.formId, 'SubmitCreatedRFC');

        // Attachments: drop zone + click-to-browse + square icon tiles
        const bin = document.getElementById('AttachBin');
        const fileInput = document.getElementById('cr-file-input');
        bin?.addEventListener('click', () => fileInput?.click());
        bin?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput?.click(); }
        });
        bin?.addEventListener('dragover', (e) => {
            e.preventDefault();
            bin.classList.add('is-dragover');
        });
        bin?.addEventListener('dragleave', () => bin.classList.remove('is-dragover'));
        bin?.addEventListener('drop', (e) => {
            e.preventDefault();
            bin.classList.remove('is-dragover');
            this._addFiles(e.dataTransfer?.files);
        });
        fileInput?.addEventListener('change', (e) => {
            this._addFiles(e.target.files);
            e.target.value = '';
        });
    }

    // -------------------------  Attachments  ------------------------- //

    _addFiles(list) {
        if (!list?.length) return;

        // Cap the total at 5 attachments, matching the shared Composer.
        const MAX_ATTACHMENTS = 5;
        const remaining = MAX_ATTACHMENTS - this.files.length;
        if (remaining <= 0) {
            UI.toast?.(`Maximum ${MAX_ATTACHMENTS} attachments allowed`, 'warning');
            return;
        }
        const incoming = Array.from(list);
        if (incoming.length > remaining) {
            UI.toast?.(`Maximum ${MAX_ATTACHMENTS} attachments allowed`, 'warning');
        }
        this.files.push(...incoming.slice(0, remaining));
        this._renderAttachmentChips();
    }

    _renderAttachmentChips() {
        const holder = document.getElementById('cr-attachment-list');
        if (!holder) return;

        holder.replaceChildren();
        this.files.forEach((file, index) => {
            const chip = document.createElement('span');
            chip.className = 'ct-att-chip';
            chip.tabIndex = 0;

            const icon = document.createElement('span');
            icon.className = 'ct-att-icon';
            icon.setAttribute('aria-hidden', 'true');
            icon.innerHTML = (typeof Format !== 'undefined' && Format.fileIcon)
                ? Format.fileIcon(file.name) : '';

            const name = document.createElement('span');
            name.className = 'ct-att-name';
            name.textContent = file.name;

            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'ct-att-remove';
            remove.setAttribute('aria-label', `Remove ${file.name}`);
            remove.textContent = '\\u00d7';
            remove.addEventListener('click', () => {
                this.files.splice(index, 1);
                this._renderAttachmentChips();
            });

            chip.append(icon, name, remove);
            holder.appendChild(chip);
        });
    }

    // -------------------------  Submit  ------------------------- //

    async submitRFC() {
        if (!validateForm(this.formId)) return;

        const submitButton = document.getElementById('SubmitCreatedRFC');
        if (submitButton) submitButton.disabled = true;
        ToggleWaiting();

        try {
            const { formData, note } = this._collectFormData();
            const response = await this._submitRFC(formData);
            if (!response) return;

            await this._handleCreateSuccess(response, note);

        } catch (error) {
            if (error.message !== 'Unauthorized') {
                this.handleError("Error: Couldn't create RFC");
            }
        } finally {
            ToggleWaiting();
            if (submitButton) submitButton.disabled = false;
        }
    }

    // -------------------------  Data Collection  ------------------------- //

    _collectFormData() {
        const elements = document.getElementsByClassName('Value');
        const formData = Form.getValues(elements);
        const note = document.getElementById('Description')?.value ?? '';

        return { formData, note };
    }

    async _submitRFC(formData) {
        return API.post('RFC/SaveRFC',
            API.authPayload({
                ...formData,
                emailSent: 0
            })
        );
    }

    // -------------------------  Create Success  ------------------------- //

    async _handleCreateSuccess(data, note) {
        const newRfcId = data.id ?? data.rfcId;
        const message = data.message ?? 'Created';

        // The description becomes the RFC's first note, now CARRYING the
        // attachments (previously null was passed and files were lost).
        await SaveOriginalNote(this.files, true, note, newRfcId);

        const assignedTech = document.getElementById('assignedTechName');
        if (assignedTech?.selectedIndex >= 0) {
            const techId = assignedTech.options[assignedTech.selectedIndex].value;
            const techEmail = GetUserEmailAddress(techId);
            CreateAndSendEmail(newRfcId, 'Assigned', 'RFC', techEmail, '', '', '', '');
        }

        BuildMessageBox(`${message} RFC ${newRfcId}`, 'RFC');
    }
}

// -------------------------  Init  ------------------------- //

const page = new CreateRFC();
document.addEventListener('DOMContentLoaded', () => page.init());
'''

LAYOUT_TAGS = (
    '    <script src="~/js/Components/Attachments/AttachmentFiles.js" asp-append-version="true"></script>\r\n'
    '    <script src="~/js/Components/Attachments/AttachmentUI.js" asp-append-version="true"></script>\r\n'
    '    <script src="~/js/Components/Attachments/Attachments.js" asp-append-version="true"></script>\r\n'
)


def write_full(path, text, label, bom=False, crlf=False, enc='utf-8'):
    out = text.replace('\n', '\r\n') if crlf else text
    b = out.encode(enc)
    if bom:
        b = b'\xef\xbb\xbf' + b
    if os.path.exists(path) and open(path, 'rb').read() == b:
        print(f"  [skip] {label}: up to date")
        return
    with open(path, 'wb') as fh:
        fh.write(b)
    print(f"  [write] {label} ({len(b)} bytes)")


def main():
    print("HD995 — CreateRFC rebuild + legacy attachment retirement")
    print(f"  repo root: {os.path.abspath(ROOT)}")
    for p in (VIEW, JS, LAYOUT):
        if not os.path.exists(p):
            print(f"  [error] missing {p}")
            sys.exit(1)

    write_full(VIEW, CSHTML, 'CreateRFC.cshtml', bom=True, crlf=True)
    write_full(CSS, NEW_CSS, 'CreateRFC.css (new)', bom=False, crlf=False)
    write_full(JS, NEW_JS, 'CreateRFC.js', bom=False, crlf=True)

    # _Layout: drop the trio's script tags
    lay = open(LAYOUT, 'rb').read()
    tags = LAYOUT_TAGS.encode('ascii')
    if tags in lay:
        if lay.count(tags) != 1:
            print("  [error] _Layout: trio tags not unique; aborting")
            sys.exit(1)
        with open(LAYOUT, 'wb') as fh:
            fh.write(lay.replace(tags, b''))
        print("  [write] _Layout.cshtml: legacy attachment script tags removed")
    else:
        print("  [skip] _Layout.cshtml: trio tags already removed")

    # delete the trio + CreateForm.css
    for f in DELETE:
        if os.path.exists(f):
            os.remove(f)
            print(f"  [delete] {os.path.relpath(f, ROOT)}")
        else:
            print(f"  [skip] {os.path.relpath(f, ROOT)}: already deleted")

    print("Done.")
    print("  [note] run `dotnet build` to confirm the Razor compiles.")


if __name__ == '__main__':
    main()
