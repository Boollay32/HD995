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
        MessageBox.sessionTimeout();
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
        // SSRF prevention — safeUrl is always a hardcoded value, never derived from endpoint
        const whitelist = {
            'authenticator/authenticate': '/api/Authenticator/Authenticate',
            'authenticator/checkadmin': '/api/Authenticator/CheckAdmin',
            'attachment/getattachmentsnotes': '/api/Attachment/GetAttachmentsNotes',
            'attachment/getattachmentstasks': '/api/Attachment/GetAttachmentsTasks',
            'history/gethistory': '/api/History/GetHistory',
            'misc/getdropdownlist': '/api/Misc/GetDropDownList',
            'misc/getfilteritems': '/api/Misc/GetFilterItems',
            'note/getnotes': '/api/Note/GetNotes',
            'note/getrfcnotes': '/api/Note/GetRFCNotes',
            'note/savenote': '/api/Note/SaveNote',
            'notification/getnotifications': '/api/Notification/GetNotifications',
            'notification/markpipread': '/api/Notification/MarkPipRead',
            'notification/markread': '/api/Notification/MarkRead',
            'notification/ticketpips': '/api/Notification/TicketPips',
            'project/getprojectdetail': '/api/Project/GetProjectDetail',
            'project/getprojects': '/api/Project/GetProjects',
            'project/saveproject': '/api/Project/SaveProject',
            'reports/getstats': '/api/Reports/GetStats',
            'rfc/getrfcdetail': '/api/RFC/GetRFCDetail',
            'rfc/getrfcs': '/api/RFC/GetRFCs',
            'rfc/saverfc': '/api/RFC/SaveRFC',
            'task/gettasks': '/api/Task/GetTasks',
            'task/savetask': '/api/Task/SaveTask',
            'ticket/changecustomfields': '/api/Ticket/ChangeCustomFields',
            'ticket/getincidents': '/api/Ticket/GetIncidents',
            'ticket/gettickets': '/api/Ticket/GetTickets',
            'ticket/getunassignedcrs': '/api/Ticket/GetUnassignedCRs',
            'ticket/saveticket': '/api/Ticket/SaveTicket',
            'ticket/setticketproject': '/api/Ticket/SetTicketProject',
            'ticketdetails/getactivity': '/api/TicketDetails/GetActivity',
            'ticketdetails/getticketdetail': '/api/TicketDetails/GetTicketDetail',
            'user/createuser': '/api/User/CreateUser',
            'user/deleteuser': '/api/User/DeleteUser',
            'user/getauthorityclients': '/api/User/GetAuthorityClients',
            'user/getuserdetail': '/api/User/GetUserDetail',
            'user/getusers': '/api/User/GetUsers',
            'user/manageuser': '/api/User/ManageUser',
            'user/resetuser': '/api/User/ResetUser',
            'user/updateuser': '/api/User/UpdateUser'
        };


        const key = endpoint.toLowerCase().replace(/^\/api\//i, '');

        // safeUrl comes from hardcoded whitelist — taint chain from endpoint is broken
        const safeUrl = Object.entries(whitelist).find(([k]) => key.startsWith(k))?.[1];

        if (!safeUrl) {
            throw new Error(`Endpoint '${endpoint}' is not permitted.`);
        }

        try {
            const response = await fetch(safeUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.status === 401) {
                MessageBox.sessionTimeout();
                return null;
            }

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            // DEV ONLY: the server reports would-be mail recipients in this
            // header (no real SMTP send locally); absent/ignored in production.
            const mailPreview = response.headers.get('X-Mail-Preview');
            if (mailPreview && window.MailPreview) {
                await window.MailPreview.show(mailPreview);
            }

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
