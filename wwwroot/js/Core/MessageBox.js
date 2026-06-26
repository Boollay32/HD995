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

    _setMessage(messageBox, outerDiv, message) {
        outerDiv?.classList.remove('Large');

        if (messageBox) {
            messageBox.innerHTML = '';
            const p = document.createElement('p');
            p.id = 'MessageBox-Message';
            p.innerText = message;           // innerText — XSS safe
            messageBox.appendChild(p);
        }

        document.getElementById('MessageBox-Message')
            ?.classList.remove('Large');
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

    show(message, loadPage = '') {
        this.build(message, loadPage);
    },

    // -------------------------  Build  ------------------------- //

    build(message, loadPage) {
        const { screenCover, messageBox, outerDiv, buttonDiv } = this._getElements();
        if (!screenCover || !buttonDiv) return;

        this._setMessage(messageBox, outerDiv, message);

        buttonDiv.innerHTML = '';

        const okayBtn = document.createElement('button');
        okayBtn.className = 'accept OkayButton';
        okayBtn.innerText = 'Okay';
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
