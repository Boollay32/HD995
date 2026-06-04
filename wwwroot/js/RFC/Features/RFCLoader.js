// =============================  RFCLoader.js  ============================= //
// Data fetch for the RFC detail page. RFCDetails orchestrates load -> populate.

'use strict';

const RFCLoader = {
    async getDetails(rfcId) {
        return API.post(
            'ChangeRequest/GetChangeRequestDetail',
            API.authPayload({ rfcId })
        );
    },
};
