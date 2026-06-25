// =====================  Tasks.js  ===================== //
// In-ticket task list with inline-expand editing.
//
// Reads the real TaskStub fields (camelCase wire): taskID, title,
// description, progressLog, assignedTech (name), status (int),
// important (bool), requiredDate, completed, attachments[].
//
// Saves the full field set through TicketDetails/SaveTask using the
// objectInfo keys TaskMapper accepts. Existing attachments are echoed
// back on every save so they are never silently dropped.
//
// Status legend: 1 New, 2 In Progress, 3 Complete, 4 Withdrawn, 5 Draft.
// "Done" == Complete (3).
// ===================================================== //

'use strict';

const Tasks = (() => {

    // -------------------------  Constants  ------------------------- //

    const DONE = 3;        // Complete
    const WITHDRAWN = 4;

    // Status display constants live in TaskPopulation (loaded first).
    const { STATUS, STATUS_LABEL, STATUS_CLASS } = TaskPopulation;
    const NEW_ID = '__new__';

    // -------------------------  State  ------------------------- //

    const State = {
        ticketId: null,
        tasks: [],
        techs: [],          // [{ id, name }]
        isLoading: false,
        isSaving: false,
        openId: null,       // taskID currently expanded, or NEW_ID, or null
        dirty: false,
        guardsHooked: false,
    };

    // -------------------------  DOM refs  ------------------------- //

    const Dom = {
        taskList: () => document.getElementById('Task-List'),
        progressFill: () => document.getElementById('task-progress-fill'),
        progressLabel: () => document.getElementById('task-progress-label'),
        progressTrack: () => document.getElementById('task-progress-track'),
        addTaskBtn: () => document.getElementById('add-task-btn'),
        compose: () => document.getElementById('Task-Compose'),
        panel: () => document.getElementById('tabpanel-tasks'),
    };

    // -------------------------  Helpers  ------------------------- //

    // Pure formatters/escapers come from TaskPopulation; stateful and
    // constant-dependent helpers stay here. Merged so H.esc / H.statusOf /
    // H.isOverdue / H.isDone / H.nameToId all keep working unchanged.
    const H = {
        ...TaskPopulation,
        isOverdue(raw, status) {
            if (!raw || status === DONE || status === WITHDRAWN) return false;
            const due = new Date(raw);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return due < today;
        },
        isDone(t) { return H.statusOf(t) === DONE; },
        nameToId(name) {
            if (!name) return null;
            const hit = State.techs.find(x => x.name === name);
            return hit ? hit.id : null;
        },
    };
    // Builds the pipe-backtick objectInfo string TaskMapper parses.
    // Keeps "0" (e.g. important=0); drops only null / undefined / "".
    function _objectInfo(fields) {
        return Object.entries(fields)
            .filter(([, v]) => v !== null && v !== undefined && v !== '')
            .map(([k, v]) => `${k}\`${v}`)
            .join('|');
    }

    // Map a task's current attachments to the wire shape SaveTask expects,
    // so they are preserved (not wiped) on save.
    function _echoAttachments(task) {
        const list = Array.isArray(task?.attachments) ? task.attachments : [];
        return list
            .filter(a => a && a.attachmentByteArray)
            .slice(0, 5)
            .map(a => ({
                attachmentByteArray: a.attachmentByteArray,
                attachmentName: a.attachmentName ?? '',
                attachmentImageType: a.attachmentImageType ?? 0,
            }));
    }


    // -------------------------  Init  ------------------------- //

    function init(ticketId) {
        State.ticketId = parseInt(ticketId, 10);
        State.openId = null;
        State.dirty = false;

        Dom.addTaskBtn()?.addEventListener('click', _onAddClick);
        _hookGuards();

        _loadTechs();
        _getTasks();
    }

    async function _loadTechs() {
        try {
            const data = await API.post(
                'Misc/GetDropDownList',
                API.authPayload({
                    filter: sessionStorage.getItem(STORAGE_KEYS.SEARCH_OR_TICKET) ?? '0',
                    group: 'Task',
                })
            );
            // The 'Task' dropdown group returns the tech list under the proc's
        // column name 'assignedTechName' (old key kept as a fallback).
        const raw = data?.assignedTechName ?? data?.assignedTech;
            if (Array.isArray(raw)) {
                State.techs = raw
                    .map(it => ({ id: String(it.id ?? it.value ?? ''), name: it.name ?? it.text ?? '' }))
                    .filter(x => x.id && x.name);
            }
        } catch (err) {
            console.error('Tasks._loadTechs:', err);
        }
    }

    // -------------------------  Get tasks  ------------------------- //

    async function _getTasks() {
        if (State.isLoading) return;
        State.isLoading = true;
        try {
            const data = await API.post(
                'TicketDetails/GetTasks',
                API.authPayload({ filters: { TicketID: String(State.ticketId) } })
            );
            State.tasks = Array.isArray(data) ? data : [];
            // Attachments are not returned by GetTasks; fetch them
            // separately and merge by task id so they display + open.
            try {
                const attMap = await Composer.fetchTaskAttachments(State.ticketId);
                State.tasks.forEach(t => {
                    const tid = t.taskID;
                    t.attachments = (attMap.get(tid) || attMap.get(String(tid)) || []);
                });
            } catch (e) { /* non-fatal: tasks still render without attachments */ }
            _render();

            // Arriving from the Tasks queue: auto-expand the task the user
            // clicked so they can see which one they just opened. One-shot:
            // the key is consumed so a refresh does not re-expand it.
            const arriveId = sessionStorage.getItem(STORAGE_KEYS.TASK_ID);
            sessionStorage.removeItem(STORAGE_KEYS.TASK_ID);
            if (arriveId && State.tasks.some(t => String(t.taskID) === String(arriveId))) {
                _openEditor(String(arriveId));
            }
        } catch (err) {
            console.error('Tasks._getTasks:', err);
            UI.toast?.('Failed to load tasks', 'error');
        } finally {
            State.isLoading = false;
        }
    }

    // -------------------------  Render  ------------------------- //

    function _render() {
        const list = Dom.taskList();
        if (!list) return;

        State.openId = null;
        State.dirty = false;
        list.innerHTML = '';

        if (!State.tasks.length) {
            list.appendChild(_emptyState());
            _updateProgress();
            _updatePip();
            return;
        }

        // Closed tasks sort to the bottom: completed first, then withdrawn at the
        // very end (both shown -- withdrawn appears crossed out). Open tasks keep
        // their status/required-date ordering above them.
        const closedRank = t => {
            const s = H.statusOf(t);
            if (s === 4) return 2;   // Withdrawn -- very bottom
            if (s === 3) return 1;   // Complete -- below open
            return 0;                // open
        };
        const sorted = [...State.tasks].sort((a, b) => {
            const ar = closedRank(a), br = closedRank(b);
            if (ar !== br) return ar - br;
            const as = H.statusOf(a), bs = H.statusOf(b);
            if (as !== bs) return as - bs;
            if (a.requiredDate && b.requiredDate) return new Date(a.requiredDate) - new Date(b.requiredDate);
            return 0;
        });

        const frag = document.createDocumentFragment();
        sorted.forEach(t => frag.appendChild(_buildItem(t)));
        list.appendChild(frag);

        _updateProgress();
        _updatePip();
    }

    const _emptyState = TaskPopulation.emptyState;

    // -------------------------  Item (collapsed summary)  ------------------------- //

    function _buildItem(task) {
        const item = document.createElement('div');
        item.className = 'td-task-item';
        item.dataset.tid = task.taskID;

        const done = H.isDone(task);
        const status = H.statusOf(task);
        if (done) item.classList.add('is-complete');
        if (H.isOverdue(task.requiredDate, status)) item.classList.add('is-overdue');

        const dueLabel = task.requiredDate ? H.formatDate(task.requiredDate) : '\u2014';

        const attachCount = Array.isArray(task.attachments) ? task.attachments.length : 0;
        item.innerHTML = TaskPopulation.itemSummaryHtml(task, { done, status, dueLabel, attachCount });

        item.querySelector('.td-task-open')
            ?.addEventListener('click', () => _requestOpen(task.taskID));
        item.querySelector('.td-task-delete-btn')
            ?.addEventListener('click', () => _deleteTask(task.taskID));

        return item;
    }

    // -------------------------  Open / close editor  ------------------------- //

    async function _requestOpen(taskId) {
        if (String(State.openId) === String(taskId)) { _onCancel(); return; }
        if (!(await _guardLeave())) return;
        _openEditor(taskId);
    }

    async function _onAddClick() {
        if (State.openId === NEW_ID) return;
        if (!(await _guardLeave())) return;
        _openEditor(NEW_ID);
    }

    function _taskById(id) {
        return State.tasks.find(t => String(t.taskID) === String(id)) || null;
    }

    function _openEditor(id) {
        _collapseDom();

        const list = Dom.taskList();
        if (!list) return;

        const isNew = id === NEW_ID;
        const task = isNew ? { taskID: '', title: '', status: 1, important: false } : _taskById(id);
        if (!task) return;

        // Both new and existing tasks open full-panel: hide the list/progress/
        // add button and render the editor into the dedicated compose container.
        Dom.panel()?.classList.add('is-composing');
        const host = Dom.compose();
        if (!host) return;
        host.hidden = false;
        host.replaceChildren();

        const editor = document.createElement('div');
        editor.className = 'td-task-editor';
        editor.innerHTML = _editorHtml(task, isNew);
        host.appendChild(editor);

        _bindEditor(editor, task, isNew);
        State.openId = id;
        State.dirty = false;

        setTimeout(() => editor.querySelector(
            'input:not([type="hidden"]), select, textarea')?.focus(), 40);
        editor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function _editorHtml(task, isNew) {
        const status = H.statusOf(task);
        const statusOpts = STATUS
            .map(s => `<option value="${s.v}" ${s.v === status ? 'selected' : ''}>${s.label}</option>`)
            .join('');

        const curName = task.assignedTech || '';
        const matched = State.techs.some(x => x.name === curName);
        const techOpts = State.techs
            .map(x => `<option value="${H.esc(x.id)}" ${x.name === curName ? 'selected' : ''}>${H.esc(x.name)}</option>`)
            .join('');
        const unresolved = curName && !matched
            ? `<option value="" data-keep="1" selected>${H.esc(curName)} (current)</option>`
            : '';
        const blank = `<option value="">Unassigned</option>`;

        const atts = _echoAttachments(task);

        return `
            <div class="td-ed-row">
                <div class="td-ed-title-head">
                    <label class="td-ed-label">Title</label>
                </div>
                ${isNew
                    ? `<input type="text" class="td-ed-input" data-fld="title" maxlength="200"
                       value="${H.esc(task.title || '')}" placeholder="Task title">`
                    : `<div class="td-ed-title-static">${H.esc(task.title || '')}</div>
                       <input type="hidden" data-fld="title" value="${H.esc(task.title || '')}">`}
            </div>
            <div class="td-ed-grid">
                <div class="td-ed-row">
                    <label class="td-ed-label">Status</label>
                    <select class="td-ed-input" data-fld="status">${statusOpts}</select>
                </div>
                <div class="td-ed-row">
                    <label class="td-ed-label">Assigned to</label>
                    <select class="td-ed-input" data-fld="assignedTech">${blank}${unresolved}${techOpts}</select>
                </div>
                <div class="td-ed-row">
                    <label class="td-ed-label">Due date</label>
                    <input type="date" class="td-ed-input" data-fld="requiredDate"
                           value="${H.toInputDate(task.requiredDate)}">
                </div>
                <div class="td-ed-row">
                    <label class="td-ed-label">Completion date</label>
                    <input type="date" class="td-ed-input" data-fld="completed"
                           value="${H.toInputDate(task.completed) || (status === DONE ? H.toInputDate(new Date()) : '')}">
                </div>
            </div>
            <div class="td-ed-row">
                <label class="td-ed-label">Description</label>
                <textarea class="td-ed-input td-ed-area" data-fld="description" rows="3"
                          placeholder="What needs doing?">${H.esc(task.description || '')}</textarea>
            </div>
            <div class="td-ed-row">
                <label class="td-ed-label">Progress log</label>
                <textarea class="td-ed-input td-ed-area" data-fld="progressLog" rows="3"
                          placeholder="Notes on progress\u2026">${H.esc(task.progressLog || '')}</textarea>
            </div>
            <div class="td-ed-row">
                <label class="td-ed-label">Attachments</label>
                <div class="td-att-wrap">
                    <div class="td-att-chips" data-fld="attachments"></div>
                    <button type="button" class="td-attach-btn" data-att-add aria-label="Add attachment">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66L9.41 17.41a2 2 0 01-2.83-2.83l8.49-8.48"/>
                        </svg>
                    </button>
                    <input type="file" class="td-att-input" data-att-input multiple hidden>
                </div>
            </div>
            <div class="td-ed-foot">
                <span class="td-ed-dirty" hidden>Unsaved changes</span>
                <div class="td-ed-foot-btns">
                    <button type="button" class="td-imp-pill" data-fld="important"
                            aria-pressed="${task.important ? 'true' : 'false'}">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M4 21V4a1 1 0 011-1h11l-2 4 2 4H5"/>
                        </svg>
                        <span>${task.important ? 'Important' : 'Mark as important'}</span>
                    </button>
                    <button type="button" class="td-btn-ghost" data-act="cancel">${isNew ? 'Cancel' : 'Back to tasks'}</button>
                    <button type="button" class="td-btn-primary" data-act="save"${isNew ? '' : ' disabled'}>${isNew ? 'Add task' : 'Save changes'}</button>
                </div>
            </div>`;
    }

    function _bindEditor(editor, task, isNew) {
        editor._kept = _echoAttachments(task);

        // Dirty = any tracked control, the Important pill, or the attachment
        // set differs from its value when the editor opened. Re-evaluated on
        // every change rather than latched, so reverting a field back to its
        // original value clears the dirty state. New tasks keep Save enabled.
        const fldEls = Array.from(editor.querySelectorAll(
            'input[data-fld], select[data-fld], textarea[data-fld]'));
        const fldBaseline = fldEls.map(el => el.value);
        const impPill = editor.querySelector('.td-imp-pill');
        const impBaseline = impPill ? impPill.getAttribute('aria-pressed') : null;
        const attKey = () => editor._kept.map(a => a.attachmentName).join('\u001f');
        const attBaseline = attKey();

        const markDirty = () => {
            const isDirty =
                fldEls.some((el, i) => el.value !== fldBaseline[i])
                || (impPill && impPill.getAttribute('aria-pressed') !== impBaseline)
                || attKey() !== attBaseline;
            State.dirty = isDirty;
            editor.querySelector('.td-ed-dirty')?.toggleAttribute('hidden', !isDirty);
            if (!isNew) {
                const saveBtn = editor.querySelector('[data-act="save"]');
                if (saveBtn) saveBtn.disabled = !isDirty;
            }
        };

        editor.querySelectorAll('input[data-fld], select[data-fld], textarea[data-fld]').forEach(el => {
            el.addEventListener('input', markDirty);
            el.addEventListener('change', markDirty);
        });

        const attHolder = editor.querySelector('[data-fld="attachments"]');
        const renderAtts = () => {
            if (!attHolder) return;
            // Canonical attachment tiles via the shared Attachments component.
            // _kept is camelCase; map to the component's {name, base64} shape.
            // Items carry base64 -> download on click; corner badge removes
            // (the editor is edit mode, so canRemove:true).
            attHolder.replaceChildren(Attachments.render(
                editor._kept.map(a => ({ name: a.attachmentName, base64: a.attachmentByteArray })),
                {
                    canRemove: true,
                    onRemove: (att, idx) => {
                        editor._kept.splice(idx, 1);
                        markDirty();
                        renderAtts();
                    },
                }
            ));
        };
        renderAtts();

        // Important pill: toggle aria-pressed + label.
        const impBtn = editor.querySelector('.td-imp-pill');
        impBtn?.addEventListener('click', () => {
            const on = impBtn.getAttribute('aria-pressed') !== 'true';
            impBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
            const lbl = impBtn.querySelector('span');
            if (lbl) lbl.textContent = on ? 'Important' : 'Mark as important';
            markDirty();
        });

        // 6d: when the task is switched to Complete, default the completion
        // date to today (only if it has not already been given one).
        const statusSel = editor.querySelector('[data-fld="status"]');
        const completedInput = editor.querySelector('[data-fld="completed"]');
        statusSel?.addEventListener('change', () => {
            if (parseInt(statusSel.value, 10) === DONE && completedInput && !completedInput.value) {
                completedInput.value = H.toInputDate(new Date());
                markDirty();
            }
        });

        // Add file: encode picked files and append to the kept list.
        const addBtn = editor.querySelector('[data-att-add]');
        const fileInput = editor.querySelector('[data-att-input]');
        addBtn?.addEventListener('click', () => fileInput?.click());
        fileInput?.addEventListener('change', async () => {
            const files = Array.from(fileInput.files || []);
            if (!files.length) return;
            try {
                const encoded = await Composer.encode(files);
                // Composer.encode returns PascalCase; the kept list + renderer
                // use camelCase, so map before pushing.
                encoded.forEach(a => editor._kept.push({
                    attachmentName: a.AttachmentName,
                    attachmentByteArray: a.AttachmentByteArray,
                    attachmentImageType: a.AttachmentImageType ?? 0,
                }));
                renderAtts();
                markDirty();
            } catch (e) {
                UI.toast?.('Could not attach file', 'warning');
            } finally {
                fileInput.value = '';
            }
        });

        editor.querySelector('[data-act="cancel"]')?.addEventListener('click', _onCancel);
        editor.querySelector('[data-act="save"]')?.addEventListener('click', () => _saveEditor(editor, task, isNew));
    }

    async function _onCancel() {
        if (State.dirty) {
            const ok = await Confirm.ask({
                title: 'Discard changes?',
                message: 'Your edits to this task will be lost.',
                confirmText: 'Discard',
                cancelText: 'Keep editing',
                danger: true,
            });
            if (!ok) return;
        }
        _closeEditor();
    }

    function _closeEditor() {
        _collapseDom();
        State.openId = null;
        State.dirty = false;
    }

    function _collapseDom() {
        // Leave compose mode if we were in it.
        Dom.panel()?.classList.remove('is-composing');
        const compose = Dom.compose();
        if (compose) { compose.replaceChildren(); compose.hidden = true; }

        const list = Dom.taskList();
        if (!list) return;
        list.querySelector(`.td-task-item.is-new[data-tid="${NEW_ID}"]`)?.remove();
        list.querySelectorAll('.td-task-item.is-editing').forEach(item => {
            item.classList.remove('is-editing');
            item.querySelector('.td-task-open')?.setAttribute('aria-expanded', 'false');
            item.querySelector('.td-task-editor')?.remove();
        });
    }

    // -------------------------  Save (editor)  ------------------------- //

    async function _saveEditor(editor, task, isNew) {
        if (State.isSaving) return;

        const get = (f) => editor.querySelector(`[data-fld="${f}"]`);
        const title = (get('title')?.value || '').trim();
        if (!title) {
            get('title')?.focus();
            UI.toast?.('Please enter a task title', 'warning');
            return;
        }

        const status = parseInt(get('status')?.value ?? '1', 10);
        const important = get('important')?.getAttribute('aria-pressed') === 'true' ? '1' : '0';
        const requiredDate = get('requiredDate')?.value || '';

        const assignSel = get('assignedTech');
        const selOpt = assignSel?.options[assignSel.selectedIndex];
        const assignKeep = selOpt?.dataset?.keep === '1';
        const assignedTech = assignKeep ? '' : (assignSel?.value || '');

        // Completion date comes from its editable field (YYYY-MM-DD, like the
        // due date). It is REQUIRED when the task is being marked Complete --
        // a task can't be completed without recording when.
        let completed = get('completed')?.value || '';
        if (status === DONE && !completed) {
            get('completed')?.focus();
            UI.toast?.('Please set a completion date before marking the task complete', 'warning');
            return;
        }

        const fields = {
            TaskID: isNew ? '' : task.taskID,
            TicketID: State.ticketId,
            title,
            description: get('description')?.value ?? '',
            progressLog: get('progressLog')?.value ?? '',
            status,
            important,
            requiredDate,
            completed,
        };
        if (!assignKeep) fields.assignedTech = assignedTech;

        await _commit(_objectInfo(fields), editor._kept, isNew ? 'Task added' : 'Task updated', editor);
    }

    async function _commit(objectInfo, attachments, successMsg, editor) {
        State.isSaving = true;
        const saveBtn = editor?.querySelector('[data-act="save"]');
        const origLabel = saveBtn?.textContent;
        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving\u2026'; }

        try {
            const data = await API.post(
                'TicketDetails/SaveTask',
                API.authPayload({ objectInfo, attachments: attachments ?? [] })
            );
            if (!data) throw new Error('SaveTask returned null');

            // Close the editor, then re-fetch the task list from the server
            // (same loader the manual refresh uses) so the new/edited task
            // appears immediately. Stays on the Tasks tab -- no page reload.
            _closeEditor();
            UI.toast?.(successMsg, 'success');
            await _getTasks();
            // Refresh the activity timeline so the new/updated task shows.
            if (typeof Activity !== 'undefined') Activity.refresh();
        } catch (err) {
            console.error('Tasks._commit:', err);
            UI.toast?.('Failed to save task', 'error');
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = origLabel || 'Save'; }
        } finally {
            State.isSaving = false;
        }
    }


    // -------------------------  Delete  ------------------------- //

    async function _deleteTask(taskId) {
        const task = _taskById(taskId);
        if (!task) return;

        if (State.dirty && State.openId !== null) {
            const safe = await _guardLeave();
            if (!safe) return;
        }

        const ok = await Confirm.ask({
            title: 'Delete task?',
            message: `\u201C${task.title || 'This task'}\u201D will be removed. This can\u2019t be undone.`,
            confirmText: 'Delete',
            cancelText: 'Cancel',
            danger: true,
        });
        if (!ok) return;

        const snapshot = [...State.tasks];
        State.tasks = State.tasks.filter(t => String(t.taskID) !== String(taskId));
        _render();

        try {
            // Delete = withdraw (status 4). There is no hard-delete; withdrawn
            // tasks drop out of the normal list (see _render) but remain in the
            // data, searchable by the Withdrawn filter.
            const objectInfo = _objectInfo({
                TaskID: taskId,
                TicketID: State.ticketId,
                title: task.title || '',
                status: 4,
            });
            const data = await API.post(
                'TicketDetails/SaveTask',
                API.authPayload({ objectInfo, attachments: [] })
            );
            if (!data) throw new Error('Delete returned null');
            if (Array.isArray(data)) { State.tasks = data; _render(); }
        } catch (err) {
            console.error('Tasks._deleteTask:', err);
            State.tasks = snapshot;
            _render();
            UI.toast?.('Failed to delete task', 'error');
        }
    }

    // -------------------------  Progress + pip  ------------------------- //

    function _updateProgress() {
        const relevant = State.tasks.filter(t => H.statusOf(t) !== WITHDRAWN);
        const done = relevant.filter(H.isDone).length;
        const total = relevant.length;
        const pct = total ? Math.round((done / total) * 100) : 0;

        const fill = Dom.progressFill();
        if (fill) { fill.style.width = `${pct}%`; fill.setAttribute('aria-valuenow', pct); }

        const label = Dom.progressLabel();
        if (label) label.textContent = total === 0 ? 'No tasks' : `${done} of ${total} complete`;

        Dom.progressTrack()?.classList.toggle('is-complete', total > 0 && pct === 100);
    }

    function _updatePip() {
        if (typeof Tabs === 'undefined') return;
        const open = State.tasks.filter(t => {
            const s = H.statusOf(t);
            return s !== DONE && s !== WITHDRAWN;
        }).length;
        Tabs.setPip('tasks', open);
    }

    // -------------------------  Unsaved-changes guards  ------------------------- //

    async function _guardLeave() {
        if (!State.dirty || State.openId === null) return true;
        const choice = await Confirm.guard();
        if (choice === 'cancel') return false;
        if (choice === 'discard') { _closeEditor(); return true; }
        if (choice === 'save') {
            const editor = Dom.taskList()?.querySelector('.td-task-item.is-editing .td-task-editor');
            const isNew = State.openId === NEW_ID;
            const task = isNew ? { taskID: '' } : _taskById(State.openId);
            if (editor) await _saveEditor(editor, task || { taskID: '' }, isNew);
            return !State.dirty; // proceed only if the save cleared the dirty flag
        }
        return false;
    }

    function _hookGuards() {
        if (State.guardsHooked) return;
        State.guardsHooked = true;

        window.addEventListener('beforeunload', (e) => {
            if (State.dirty) { e.preventDefault(); e.returnValue = ''; }
        });

        document.addEventListener('click', async (e) => {
            const tab = e.target.closest?.('[role="tab"]');
            if (!tab || tab.id === 'tab-tasks') return;
            if (!State.dirty || State.openId === null) return;

            e.preventDefault();
            e.stopImmediatePropagation();
            const safe = await _guardLeave();
            if (safe) tab.click();
        }, true);
    }

    // 2d: re-clicking the active Tasks tab reloads the list and closes any
    // open editor, guarding unsaved changes first.
    async function _reload() {
        if (!(await _guardLeave())) return;
        if (State.openId !== null) _closeEditor();
        await _getTasks();
    }

    // -------------------------  Public API  ------------------------- //

    return {
        init,
        refresh: _getTasks,
        reload: _reload,
    };

})();
