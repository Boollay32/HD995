// ErrorPage.js -- wires the error page buttons via addEventListener (moved
// out of inline onclick handlers so script-src can later drop 'unsafe-inline').
document.addEventListener('DOMContentLoaded', function () {
    var copy = document.getElementById('Copy-Reference-Button');
    if (copy) {
        copy.addEventListener('click', function () {
            var ref = document.getElementById('Request-Id');
            if (ref && navigator.clipboard) navigator.clipboard.writeText(ref.innerText);
        });
    }
    var back = document.getElementById('Go-Back-Button');
    if (back) back.addEventListener('click', function () { history.back(); });
});
