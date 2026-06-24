const AdminContext = (() => {
    let _adminLevel = null;

    return {
        async resolve() {
            if (_adminLevel !== null) return _adminLevel;

            const level = await API.post('Authenticator/CheckAdmin', {
                userName: sessionStorage.getItem(STORAGE_KEYS.USER_NAME),
                utc: UTCWorkAround()
            });

            _adminLevel = parseInt(level ?? '0', 10);
            return _adminLevel;
        },

        get cached() { return _adminLevel; },

        reset() { _adminLevel = null; }
    };
})();
