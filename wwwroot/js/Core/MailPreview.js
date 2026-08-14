// MailPreview.js -- shows who an action emailed (or would have emailed), in
// EVERY environment. The server reports recipients in the X-Mail-Preview
// response header with a per-entry `sent` flag: true when the real SMTP send
// happened (live, Mail:SendEnabled), false when sending is disabled (dev /
// test). API.post calls MailPreview.show(header); no-op when absent.
(function () {
    'use strict';

    function _decode(b64) {
        try { return JSON.parse(decodeURIComponent(escape(atob(b64)))); }
        catch (e) {
            try { return JSON.parse(atob(b64)); } catch (_) { return null; }
        }
    }

    function _styles() {
        if (document.getElementById('mail-preview-styles')) return;
        var s = document.createElement('style');
        s.id = 'mail-preview-styles';
        s.textContent = [
            '#mail-preview-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);',
            'display:flex;align-items:center;justify-content:center;z-index:99999;}',
            '.mail-preview-card{font-family:"Spline Sans",system-ui,sans-serif;background:#fff;',
            'color:#1c1c1c;border-radius:12px;max-width:520px;width:90%;max-height:80vh;',
            'overflow:auto;box-shadow:0 12px 40px rgba(0,0,0,.3);}',
            '.mail-preview-head{display:flex;align-items:center;gap:8px;padding:14px 18px;',
            'border-bottom:1px solid #e5e5e5;font-weight:600;font-size:15px;}',
            '.mail-preview-head .tag{font-size:11px;font-weight:700;color:#8a5a00;',
            'background:#ffe8bf;padding:2px 8px;border-radius:999px;letter-spacing:.04em;}',
            '.mail-preview-body{padding:6px 18px 14px;}',
            '.mail-preview-entry{padding:10px 0;border-bottom:1px solid #f0f0f0;}',
            '.mail-preview-entry:last-child{border-bottom:none;}',
            '.mail-preview-point{font-weight:600;font-size:13px;margin-bottom:5px;}',
            '.mail-preview-row{font-size:13px;margin:2px 0;}',
            '.mail-preview-row .k{color:#777;display:inline-block;min-width:74px;',
            'vertical-align:top;}',
            '.mail-preview-to{font-family:"Spline Sans Mono",ui-monospace,monospace;}',
            '.mail-preview-frame{width:100%;height:260px;border:1px solid #e5e5e5;',
            'border-radius:8px;margin-top:8px;background:#fff;}',
            '.mail-preview-foot{padding:12px 18px;text-align:right;}',
            '.mail-preview-foot button{font:inherit;font-weight:600;font-size:13px;',
            'cursor:pointer;border:none;border-radius:8px;padding:8px 16px;',
            'background:#484848;color:#fff;}'
        ].join('');
        document.head.appendChild(s);
    }

    function _close() {
        var o = document.getElementById('mail-preview-overlay');
        if (o) o.remove();
    }

    // Sent (live) receipts surface as a passing toast -- the send already
    // happened, so there is nothing to inspect and no reason to block the
    // flow behind a modal. The popup remains for batches containing any
    // UNSENT entry (dev / test, password reset): there the popup is the only
    // way to see who would have been mailed and to inspect the body.
    function _toastReceipt(entries) {
        var recips = [];
        entries.forEach(function (en) {
            (en.recipients || []).filter(Boolean).forEach(function (r) {
                if (recips.indexOf(r) === -1) recips.push(r);
            });
        });
        var who = recips.length === 0 ? 'recipients'
            : recips.length <= 3 ? recips.join(', ')
            : recips.slice(0, 3).join(', ') + ' +' + (recips.length - 3) + ' more';
        var subject = entries.length === 1 ? (entries[0].subject || '') : '';
        UI.toast('Email sent to ' + who + (subject ? ' \u2014 ' + subject : ''), 'success');
    }

    function show(payload) {
        var entries = Array.isArray(payload) ? payload : _decode(payload);
        if (!entries || entries.length === 0) return Promise.resolve();

        var allSent = entries.every(function (e) { return !!e.sent; });
        if (allSent && window.UI && typeof UI.toast === 'function') {
            _toastReceipt(entries);
            return Promise.resolve();
        }

        _styles();
        _close();

        var _resolve;
        var _done = new Promise(function (r) { _resolve = r; });
        function dismiss() { _close(); _resolve(); }

        var overlay = document.createElement('div');
        overlay.id = 'mail-preview-overlay';
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) dismiss();
        });

        var card = document.createElement('div');
        card.className = 'mail-preview-card';

        var head = document.createElement('div');
        head.className = 'mail-preview-head';
        var anySent = entries.some(function (e) { return !!e.sent; });
        head.innerHTML = anySent
            ? '<span class="tag">SENT</span><span>Email sent &mdash; notified:</span>'
            : '<span class="tag">NOT SENT</span><span>Email not sent &mdash; would notify:</span>';
        card.appendChild(head);

        var body = document.createElement('div');
        body.className = 'mail-preview-body';

        entries.forEach(function (en) {
            var recips = (en.recipients || []).filter(Boolean);

            var row = document.createElement('div');
            row.className = 'mail-preview-entry';

            var pt = document.createElement('div');
            pt.className = 'mail-preview-point';
            pt.textContent = en.point || 'Notification';
            row.appendChild(pt);

            var to = document.createElement('div');
            to.className = 'mail-preview-row';
            var tk = document.createElement('span');
            tk.className = 'k';
            tk.textContent = 'To';
            var tv = document.createElement('span');
            tv.className = 'mail-preview-to';
            tv.textContent = recips.length ? recips.join(', ') : '(no recipient resolved)';
            to.appendChild(tk);
            to.appendChild(tv);
            row.appendChild(to);

            if (en.subject) {
                var sub = document.createElement('div');
                sub.className = 'mail-preview-row';
                var sk = document.createElement('span');
                sk.className = 'k';
                sk.textContent = 'Subject';
                var sv = document.createElement('span');
                sv.textContent = en.subject;
                sub.appendChild(sk);
                sub.appendChild(sv);
                row.appendChild(sub);
            }

            // Sent (live): compact receipt only -- who + subject. The body
            // iframe renders solely when the email was NOT sent, where the
            // popup is the only way to inspect the content at all.
            if (en.body && !en.sent) {
                var frame = document.createElement('iframe');
                frame.className = 'mail-preview-frame';
                frame.setAttribute('sandbox', '');
                frame.setAttribute('title', 'Email preview');
                row.appendChild(frame);
                // srcdoc isn't available until the iframe is in the document.
                requestAnimationFrame(function () { frame.srcdoc = en.body; });
            }

            body.appendChild(row);
        });
        card.appendChild(body);

        var foot = document.createElement('div');
        foot.className = 'mail-preview-foot';
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = 'Got it';
        btn.addEventListener('click', dismiss);
        foot.appendChild(btn);
        card.appendChild(foot);

        overlay.appendChild(card);
        document.body.appendChild(overlay);
        return _done;
    }

    window.MailPreview = { show: show };
})();