// ThemeInit.js -- anti-flash theme bootstrap. Loaded synchronously in
// <head> before any CSS so navigating pages doesn't flash light then snap
// to dark. Moved out of an inline <script> so script-src can later drop
// 'unsafe-inline'. Mirrors Theme.initial() (key hd32-theme, else OS pref).
(function () {
    try {
        var t = localStorage.getItem('hd32-theme');
        if (t !== 'light' && t !== 'dark') {
            t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
        }
        document.documentElement.setAttribute('data-theme', t);
    } catch (e) {}
})();
