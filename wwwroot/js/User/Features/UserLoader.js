// =============================  UserLoader.js  ============================= //
// Data fetch for the user detail page. UserDetails orchestrates load -> populate.

'use strict';

const UserLoader = {
    async getDetail(userLogin) {
        return API.post(
            'User/GetUserDetail',
            API.authPayload({ userId: userLogin })
        );
    },
};
