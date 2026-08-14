// MailPreview.js -- surfaces who an action emailed (or would have emailed)
// as a passing toast, in EVERY environment. The server reports recipients in
// the X-Mail-Preview response header with a per-entry `sent` flag: true when
// the real SMTP send happened (live, Mail:SendEnabled), false when sending
// is disabled (dev / test). API.post calls MailPreview.show(header); no-op
// when absent.
//
// Deliberately toast-only: the old modal (with a full body preview for
// unsent mail) is gone -- email content must not be displayed in any
// environment; only who + subject is surfaced.
(function () {
    'use strict';

    function _decode(b64) {
        try { return JSON.parse(decodeURIComponent(escape(atob(b64)))); }
        catch (e) {
            try { return JSON.parse(atob(b64)); } catch (_) { return null; }
        }
    }

    function _who(en) {
        var recips = (en.recipients || []).filter(Boolean);
        if (recips.length === 0) return '(no recipient resolved)';
        if (recips.length <= 3) return recips.join(', ');
        return recips.slice(0, 3).join(', ') + ' +' + (recips.length - 3) + ' more';
    }

    function show(payload) {
        var entries = Array.isArray(payload) ? payload : _decode(payload);
        if (!entries || entries.length === 0) return Promise.resolve();
        if (!window.UI || typeof UI.toast !== 'function') return Promise.resolve();

        entries.forEach(function (en) {
            var subject = en.subject ? ' \u2014 ' + en.subject : '';
            if (en.sent) {
                UI.toast('Email sent to ' + _who(en) + subject, 'success');
            } else {
                UI.toast('Email not sent (sending disabled) \u2014 would notify ' + _who(en) + subject, 'info');
            }
        });

        return Promise.resolve();
    }

    window.MailPreview = { show: show };
})();
