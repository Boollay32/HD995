// =============================  RFCLoader.js  ============================= //
// Data fetch for the RFC detail page. RFCDetails orchestrates load -> populate.

'use strict';

const RFCLoader = {
    async getDetails(rfcId) {
        return API.post(
            'RFC/GetRFCDetail',
            API.authPayload({ rfcId: parseInt(rfcId, 10) })
        );
    },
};
