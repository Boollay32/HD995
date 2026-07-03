// =============================  MessageBox.js  ============================= //

const MessageBox = {

    // -------------------------  Core  ------------------------- //

    _getElements() {
        const screenCover = document.getElementById('MessageBox-ScreenCover-Div');
        return {
            screenCover,
            messageBox: screenCover?.children[0]?.children[0] ?? null,
            outerDiv: document.getElementById('MessageBox-Outer-Div'),
            buttonDiv: document.getElementById('Button-Div')
        };
    },

    _setMessage(messageBox, outerDiv, message, opts = {}) {
        outerDiv?.classList.remove('Large');

        if (messageBox) {
            messageBox.innerHTML = '';

            if (opts.title) {
                const head = document.createElement('div');
                head.className = 'mb-head';
                const icon = document.createElement('span');
                icon.className = 'mb-icon';
                icon.innerHTML = MessageBox._ICONS[opts.icon] || MessageBox._ICONS.info;
                const h = document.createElement('h2');
                h.className = 'mb-title';
                h.id = 'MessageBox-Title';
                h.innerText = opts.title;    // innerText — XSS safe
                head.appendChild(icon);
                head.appendChild(h);
                messageBox.appendChild(head);
            }

            const p = document.createElement('p');
            p.id = 'MessageBox-Message';
            if (opts.title) p.classList.add('mb-msg-titled');
            p.innerText = message;           // innerText — XSS safe
            messageBox.appendChild(p);
        }

        // Name the dialog by its title when one exists; never point
        // aria-labelledby at an element that is not there.
        if (opts.title) outerDiv?.setAttribute('aria-labelledby', 'MessageBox-Title');
        else outerDiv?.removeAttribute('aria-labelledby');
    },

    // Stroke icons matching the app's inline-SVG style.
    _ICONS: {
        info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="19" height="19"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
        clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="19" height="19"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    },

    _show() {
        UI.showById('MessageBox-ScreenCover-Div');
        UI.showById('MessageBox-Outer-Div');
    },

    // Alert dialogs (single OK) dismiss on Escape or a backdrop click, then
    // run the same close action as the OK button. Confirm dialogs do not use
    // this -- a Yes/No choice must be explicit.
    _bindDismiss(onClose) {
        const cover = document.getElementById('MessageBox-ScreenCover-Div');
        const outer = document.getElementById('MessageBox-Outer-Div');
        if (!cover) return;
        const close = () => {
            document.removeEventListener('keydown', onKey);
            cover.removeEventListener('mousedown', onCover);
            onClose();
        };
        const onKey = (e) => { if (e.key === 'Escape') close(); };
        const onCover = (e) => { if (!outer || !outer.contains(e.target)) close(); };
        document.addEventListener('keydown', onKey);
        cover.addEventListener('mousedown', onCover);
    },

    // -------------------------  Public aliases  ------------------------- //
    // UserSave (and future callers) use show()/confirm(); previously these
    // did not exist, so success popups threw AFTER a successful save and
    // confirm dialogs threw before doing anything.

    show(message, loadPage = '', opts = {}) {
        this.build(message, loadPage, opts);
    },

    // The one dialog every user eventually meets: give it the full house
    // treatment rather than a bare sentence.
    sessionTimeout() {
        this.build(
            'You were signed out after a period of inactivity. Any unsaved changes were not kept.',
            'Index',
            { title: 'Session ended', icon: 'clock', okLabel: 'Sign back in' });
    },

    // -------------------------  Build  ------------------------- //

    build(message, loadPage, opts = {}) {
        const { screenCover, messageBox, outerDiv, buttonDiv } = this._getElements();
        if (!screenCover || !buttonDiv) return;

        this._setMessage(messageBox, outerDiv, message, opts);

        buttonDiv.innerHTML = '';

        const okayBtn = document.createElement('button');
        okayBtn.className = 'accept OkayButton';
        okayBtn.innerText = opts.okLabel || 'Okay';
        okayBtn.addEventListener('click', () => this.okayButtonPress(loadPage));

        buttonDiv.appendChild(okayBtn);
        this._show();
        this._bindDismiss(() => this.okayButtonPress(loadPage));
        okayBtn.focus();
    },

    // -------------------------  Okay / Close  ------------------------- //

    okayButtonPress(returnPage) {
        const screenCover = document.getElementById('MessageBox-ScreenCover-Div');
        if (screenCover) {
            screenCover.classList.remove('BackgroundTint');
            screenCover.style.display = 'none';
        }

        if (!returnPage) return;

        if (returnPage === 'Index') {
            sessionStorage.clear();
            window.open('.', '_self', false);
            return;
        }

        // Route map — replaces eval()
        const ROUTES = {
            'TicketPage': () => Router.toTicketPage(),
            'Dashboard': () => Router.toDashboard(),
            'TicketDetails': () => Router.toTicketDetails(),
            'RFC': () => Router.toRFC(),
            'RFCDetails': () => Router.toRFCDetails(),
            'UserDetails': () => Router.toUserDetails(),
            'Users': () => Router.toUserPage(),
            'UserPage': () => Router.toUserPage(),   // alias used by UserSave
            'Index': () => { sessionStorage.clear(); window.open('.', '_self', false); }
        };

        const route = ROUTES[returnPage];
        if (route) {
            route();
        } else {
            console.warn(`MessageBox: unknown route '${returnPage}'`);
        }
    },
};

// -------------------------  Legacy Wrappers  ------------------------- //

function BuildMessageBox(message, loadPage) { MessageBox.build(message, loadPage); }
function OkayButtonPress(returnPage) { MessageBox.okayButtonPress(returnPage); }
