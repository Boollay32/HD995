// =====================  TaskPopulation.js  ===================== //
// Stateless presentation + formatting for the in-ticket task list.
// Split out of Tasks.js (Phase 4a). Tasks.js folds these into its private
// H helper, so existing H.esc / H.formatDate / H.statusOf call sites are
// unchanged. MUST load BEFORE Tasks.js — the Tasks IIFE reads this at load.

'use strict';

const TaskPopulation = {

    // -------------------------  Status display  ------------------------- //

    STATUS: [
        { v: 1, label: 'New' },
        { v: 2, label: 'In Progress' },
        { v: 3, label: 'Complete' },
        { v: 4, label: 'Withdrawn' },
        { v: 5, label: 'Draft' },
    ],
    STATUS_CLASS: {
        1: 'st-new', 2: 'st-progress', 3: 'st-done', 4: 'st-withdrawn', 5: 'st-draft',
    },

    // -------------------------  Formatting  ------------------------- //

    esc(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    },
    formatDate(raw) {
        if (!raw) return '\u2014';
        const d = new Date(raw);
        if (isNaN(d)) return '\u2014';
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    },
    toInputDate(raw) {
        if (!raw) return '';
        const d = new Date(raw);
        if (isNaN(d)) return '';
        const off = d.getTimezoneOffset();
        const local = new Date(d.getTime() - off * 60000);
        return local.toISOString().split('T')[0];
    },
    statusOf(t) { return Number(t.status ?? 1); },

    // -------------------------  HTML  ------------------------- //

    attListHtml(atts) {
        if (!atts.length) return '';
        return atts.map((a, i) => {
            const nm = TaskPopulation.esc(a.attachmentName || ('Attachment ' + (i + 1)));
            const icon = Format.fileIcon(a.attachmentName || '');
            const canOpen = !!a.attachmentByteArray;
            const openAttr = canOpen ? ` data-att-open="${i}" title="Open ${nm}"` : '';
            const openCls = canOpen ? ' td-attach-chip--open' : '';
            return `<div class="td-attach-chip${openCls}" data-att="${i}"${openAttr}>` +
                `<span aria-hidden="true">${icon}</span>` +
                `<span class="td-chip-name">${nm}</span>` +
                `<button type="button" data-att-remove="${i}" aria-label="Remove ${nm}">` +
                `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>` +
                `</button>` +
                `</div>`;
        }).join('');
    },

    emptyState() {
        const div = document.createElement('div');
        div.className = 'td-thread-empty';
        div.innerHTML = `
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="9 11 12 14 22 4"/>
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
            </svg>
            <p>No tasks yet.<br>Add a task below.</p>`;
        return div;
    },

    itemSummaryHtml(task, ctx) {
        const { done, status, dueLabel, attachCount } = ctx;
        return `
            <div class="td-task-summary">
                <button type="button" class="td-task-open" aria-expanded="false">
                    <span class="td-task-title${status === 4 ? ' is-withdrawn' : ''}">
                        ${task.important ? '<span class="td-task-star" title="Important" aria-label="Important">\u2605</span>' : ''}
                        ${TaskPopulation.esc(task.title || '(untitled task)')}
                    </span>
                    <span class="td-task-meta">
                        <span class="td-task-status ${TaskPopulation.STATUS_CLASS[status] ?? ''}">${TaskPopulation.esc(TaskPopulation.STATUS_LABEL[status] ?? 'New')}</span>
                        <span class="td-task-due">${dueLabel}</span>
                        ${attachCount ? `<span class="td-task-attach" title="${attachCount} attachment${attachCount === 1 ? '' : 's'}" aria-label="${attachCount} attachment${attachCount === 1 ? '' : 's'}">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                 stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66L9.41 17.41a2 2 0 01-2.83-2.83l8.49-8.48"/>
                            </svg>${attachCount}</span>` : ''}
                        ${task.assignedTech ? `<span class="td-task-assignee">${TaskPopulation.esc(task.assignedTech)}</span>` : ''}
                    </span>
                </button>
                <div class="td-task-actions">
                    <button type="button" class="td-task-delete-btn" aria-label="Delete task">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                            <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                        </svg>
                    </button>
                </div>
            </div>`;
    },
};

// STATUS_LABEL is derived once from STATUS (kept identical to the original).
TaskPopulation.STATUS_LABEL = TaskPopulation.STATUS.reduce((m, s) => (m[s.v] = s.label, m), {});
