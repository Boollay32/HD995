// =====================  Format.js  ===================== //
//
// Shared, dependency-free display helpers used across conversational and
// list views (Notes, Messages, and available to RFC/Activity/etc.). Pure
// functions only -- no DOM, no state.

'use strict';

const Format = (() => {

    function formatTime(raw) {
        if (!raw) return '';
        const d = new Date(raw);
        if (isNaN(d)) return '';
        return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }

    function formatDate(raw) {
        if (!raw) return '';
        const d = new Date(raw);
        if (isNaN(d)) return '';
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function formatDateTime(raw) {
        if (!raw) return '';
        return `${formatDate(raw)} ${formatTime(raw)}`;
    }

    // "Today" / "Yesterday" / full weekday date -- used for thread dividers.
    function formatDateLabel(raw) {
        if (!raw) return '';
        const d = new Date(raw);
        if (isNaN(d)) return '';
        const today = new Date();
        const yest = new Date();
        yest.setDate(today.getDate() - 1);
        const sameDay = (a, b) =>
            a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate();
        if (sameDay(d, today)) return 'Today';
        if (sameDay(d, yest)) return 'Yesterday';
        return d.toLocaleDateString('en-GB', {
            weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
        });
    }

    // Stable per-day key for grouping messages under a divider.
    function dateKey(raw) {
        const d = new Date(raw);
        if (isNaN(d)) return 'unknown';
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }

    function initials(name) {
        if (!name) return '?';
        return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
    }

    function escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function fileIcon(filename) {
        const ext = filename?.split('.').pop()?.toLowerCase() ?? '';
        const map = {
            pdf: '📄', doc: '📝', docx: '📝',
            xls: '📊', xlsx: '📊',
            png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', webp: '🖼️',
            zip: '🗜️', rar: '🗜️',
            mp4: '🎬', mov: '🎬',
            mp3: '🎵',
            txt: '📃',
        };
        return map[ext] ?? '📎';
    }

    function fileSizeLabel(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    }

    return {
        formatTime, formatDate, formatDateTime, formatDateLabel,
        dateKey, initials, escapeHtml, fileIcon, fileSizeLabel,
    };

})();
