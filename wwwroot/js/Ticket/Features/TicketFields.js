// =====================  TicketFields.js  ===================== //
// Renders ticket data into the topbar pills and detail fields.
// Split out of TicketDetails.js (Phase 3a). Loaded as a global; methods run
// after DOMContentLoaded so cross-file references resolve at call time.

'use strict';

// -------------------------  Topbar helpers  ------------------------- //

const Topbar = {

    statusClass(statusId) {
        const map = {
            1: 'status-open',
            2: 'status-pending',
            3: 'status-resolved',
            4: 'status-closed',
        };
        return map[statusId] ?? 'status-open';
    },

    statusLabel(statusId) {
        const map = {
            1: 'Open',
            2: 'Pending',
            3: 'Resolved',
            4: 'Closed',
        };
        return map[statusId] ?? 'Unknown';
    },

    priorityClass(priorityId) {
        const map = {
            1: 'priority-low',
            2: 'priority-medium',
            3: 'priority-high',
        };
        return map[priorityId] ?? 'priority-low';
    },

    priorityLabel(priorityId) {
        const map = {
            1: 'Low',
            2: 'Medium',
            3: 'High',
        };
        return map[priorityId] ?? 'Low';
    },

    slaClass(slaDate) {
        if (!slaDate) return '';
        const now = new Date();
        const due = new Date(slaDate);
        const diff = (due - now) / 1000 / 60 / 60; // hours remaining

        if (diff < 0) return 'sla-breach';
        if (diff < 4) return 'sla-warning';
        return 'sla-ok';
    },

    slaLabel(slaDate) {
        if (!slaDate) return '';
        const now = new Date();
        const due = new Date(slaDate);
        const diff = Math.round((due - now) / 1000 / 60 / 60);

        if (diff < 0) return `Breached ${Math.abs(diff)}h ago`;
        if (diff < 24) return `${diff}h remaining`;
        return `${Math.round(diff / 24)}d remaining`;
    },

    renderPill(el, cssClass, label, led = true) {
        if (!el) return;
        el.className = `td-meta-pill ${cssClass}`;
        el.innerHTML = led
            ? `<span class="td-led" aria-hidden="true"></span>${label}`
            : label;
    },

    populate(data) {
        // NOTE: GetTicketDetail returns a serialized Ticket; ASP.NET Core emits
        // camelCase, and Status/Priority are stringified IDs (e.g. "2").

        // Ticket ID
        const tidEl = Dom.ticketId();
        if (tidEl) tidEl.textContent = `#${data.ticketID}`;

        // Subject
        const subEl = Dom.subject();
        if (subEl) subEl.textContent = data.subject ?? '';

        // Status pill
        Topbar.renderPill(
            Dom.metaStatus(),
            Topbar.statusClass(data.status),
            Topbar.statusLabel(data.status),
        );

        // Priority pill
        Topbar.renderPill(
            Dom.metaPriority(),
            Topbar.priorityClass(data.priority),
            Topbar.priorityLabel(data.priority),
            false,
        );

        // SLA pill — the model has no dedicated SLA field, so we treat the
        // target date as the due date. Swap to data.estimatedCompletionDate
        // if that is your real SLA source.
        if (data.targetDate) {
            Topbar.renderPill(
                Dom.metaSla(),
                Topbar.slaClass(data.targetDate),
                Topbar.slaLabel(data.targetDate),
                false,
            );
        }

        // Page title
        document.title = `#${data.ticketID} — ${data.subject ?? 'Ticket'}`;
    },
};

// -------------------------  Details population  ------------------------- //

const Fields = {

    populate(data) {
        // People
        Fields._setText('raisedby', data.raisedBy);
        Fields._setText('authority', data.authority);
        Fields._setText('requesttype', data.requestType);

        // Dates (model fields are Created / CloseDate)
        Fields._setText('created', Fields._formatDate(data.created));
        Fields._setText('closed', Fields._formatDate(data.closeDate));

        // Target date input
        const targetEl = document.getElementById('targetdate');
        if (targetEl && data.targetDate) {
            targetEl.value = data.targetDate.split('T')[0];
        }

        // Selects — populated by existing helpers
        // assignedtech, category, subcategory, priority
        // these are already handled by existing JS — no change needed
    },

    _setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value ?? '—';
    },

    _formatDate(raw) {
        if (!raw) return '—';
        const d = new Date(raw);
        if (isNaN(d)) return '—';
        return d.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    },
};

