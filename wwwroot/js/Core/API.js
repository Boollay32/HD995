// core/api.js
// Centralised API helper — replaces all fetch/$.ajax calls

const API = {

    // -------------------------  Auth  ------------------------- //

    isAuthenticated() {
        const userName = sessionStorage.getItem(STORAGE_KEYS.USER_NAME);
        // Token now lives in the httpOnly hd_session cookie (not JS-readable);
        // userName presence is the optimistic marker, a server 401 is authoritative.
        return !!userName;
    },

    handleSessionTimeout() {
        BuildMessageBox('Your session has timed out.', 'Index');
    },

    async verifySession() {
        const data = await API.post('Authenticator/Authenticate', {
            userName: sessionStorage.getItem(STORAGE_KEYS.USER_NAME),
            utc: UTCWorkAround()
        });

        if (!data?.userID) {
            API.handleSessionTimeout();
            return false;
        }
        return true;
    },

    // -------------------------  Post  ------------------------- //

    post: async function (endpoint, data) {
        const url = endpoint.startsWith('/') ? endpoint : `/api/${endpoint}`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.status === 401) {
                BuildMessageBox('Your session has timed out.', 'Index');
                return null;
            }

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            // DEV ONLY: the server reports would-be mail recipients in this
            // header (no real SMTP send locally); absent/ignored in production.
            const mailPreview = response.headers.get('X-Mail-Preview');
            if (mailPreview && window.MailPreview) {
                window.MailPreview.show(mailPreview);
            }

            // Some endpoints return a plain string (Ok(string) -> text/plain);
            // an unconditional .json() throws on those even when the call worked.
            const contentType = response.headers.get('content-type') ?? '';
            return contentType.includes('application/json')
                ? await response.json()
                : await response.text();

        } catch (error) {
            console.error(`API error [${endpoint}]:`, error);
            return null;
        }
    },

    // -------------------------  Auth Payload  ------------------------- //

    authPayload: function (extras = {}) {
        return {
            userName: sessionStorage.getItem(STORAGE_KEYS.USER_NAME),
            utc: UTCWorkAround(),
            ...extras
        };
    }
};
