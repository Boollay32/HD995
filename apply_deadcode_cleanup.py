#!/usr/bin/env python3
"""
HD995 — Dead-code cleanup (quick wins): everything here was verified to have
ZERO references anywhere in the app (Views, JS, CSS, Controllers).

Deleted files (never linked by any view, no @import, no dynamic load):
  wwwroot/css/Addons/FilterBox.css      old Stats FilterBox (replaced by rail)
  wwwroot/css/Addons/TableLayout.css    legacy table layout, unlinked
  wwwroot/css/Pages/RFC.css             superseded by RFCDetails.css, unlinked

Removed from MessageBox.js (CRLF, BOM):
  - getHelpMessage()      zero callers; its text describes the long-gone
                          drag-to-bin attachment UI
  - goBack/_goBackRFC/_goBackAdmin   zero callers AND their target DOM ids
                          (Display-ChangeRequest-Panel, CreateCRForm,
                          MainAdminPage, ...) no longer exist anywhere
  - wrappers BuildMessageBoxFunction / HelpMessageBoxes / GoBack (zero callers;
    BuildMessageBox & OkayButtonPress wrappers are alive and KEPT;
    MessageBox.confirm/buildWithCallback are alive and KEPT)

Removed from UserDetails.js (LF):
  - the legacy wrapper tail (UpdateUser/ManageUser/ResetUserQuestion/ResetUser/
    DeleteUserQuestion/DeleteUser) -- buttons were rewired to instance methods;
    zero callers incl. inline cshtml handlers

Removed from CreateTicket.js (CRLF):
  - function SubmitCreatedTicket / selector1DropDown wrappers (zero callers)

Idempotent. Usage:  python3 apply_deadcode_cleanup.py [repo_root]  (default '.')
"""

import os
import sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else '.'
P = lambda *a: os.path.join(ROOT, *a)

DELETE_FILES = [
    P('wwwroot', 'css', 'Addons', 'FilterBox.css'),
    P('wwwroot', 'css', 'Addons', 'TableLayout.css'),
    P('wwwroot', 'css', 'Pages', 'RFC.css'),
]

MB = P('wwwroot', 'js', 'Core', 'MessageBox.js')
UD = P('wwwroot', 'js', 'User', 'Pages', 'UserDetails.js')
CT = P('wwwroot', 'js', 'Ticket', 'Pages', 'CreateTicket.js')


def remove_range(data, start_marker, end_marker, label):
    s = data.find(start_marker)
    e = data.find(end_marker)
    if s == -1 and e == -1:
        print(f"  [skip] {label}: already removed")
        return data, False
    if s == -1 or e == -1 or e < s:
        print(f"  [error] {label}: markers not found as expected; aborting")
        sys.exit(1)
    if data.count(start_marker) != 1 or data.count(end_marker) != 1:
        print(f"  [error] {label}: markers not unique; aborting")
        sys.exit(1)
    return data[:s] + data[e + len(end_marker):], True


def remove_lines(data, lines, label):
    changed = False
    for ln in lines:
        if ln in data:
            if data.count(ln) != 1:
                print(f"  [error] {label}: line not unique; aborting\n    {ln[:60]!r}")
                sys.exit(1)
            data = data.replace(ln, b'')
            changed = True
    return data, changed


def main():
    print("HD995 — dead-code cleanup (quick wins)")
    print(f"  repo root: {os.path.abspath(ROOT)}")

    # ---- 1. delete the three unreferenced CSS files ----
    for f in DELETE_FILES:
        if os.path.exists(f):
            os.remove(f)
            print(f"  [delete] {os.path.relpath(f, ROOT)}")
        else:
            print(f"  [skip] {os.path.relpath(f, ROOT)}: already deleted")

    # ---- 2. MessageBox.js ----
    if not os.path.exists(MB):
        print(f"  [error] missing {MB}")
        sys.exit(1)
    mb = open(MB, 'rb').read()
    any_change = False

    mb, ch = remove_range(
        mb,
        b"\r\n    // -------------------------  Help  ------------------------- //\r\n\r\n    getHelpMessage() {",
        b"        ].join('\\n\\n');\r\n    },\r\n",
        'MessageBox.js: getHelpMessage block')
    any_change |= ch

    mb, ch = remove_range(
        mb,
        b"\r\n    // -------------------------  Go Back  ------------------------- //\r\n\r\n    goBack(location) {",
        b"        UI.showById('MainAdminPage');\r\n    }\r\n",
        'MessageBox.js: goBack/_goBackRFC/_goBackAdmin block')
    any_change |= ch

    mb, ch = remove_lines(mb, [
        b"function BuildMessageBoxFunction(message, callback) { MessageBox.buildWithCallback(message, callback); }\r\n",
        b"function HelpMessageBoxes() { return MessageBox.getHelpMessage(); }\r\n",
        b"function GoBack(location) { MessageBox.goBack(location); }\r\n",
    ], 'MessageBox.js: dead wrapper lines')
    any_change |= ch

    if any_change:
        with open(MB, 'wb') as fh:
            fh.write(mb)
        print("  [write] MessageBox.js: dead blocks removed")

    # ---- 3. UserDetails.js (LF) ----
    ud = open(UD, 'rb').read()
    ud, ch = remove_range(
        ud,
        b"// -------------------------  Legacy Wrappers  ------------------------- //\n"
        b"// Kept for any external callers; write operations now live on UserSave.\n",
        b"function DeleteUser() { userSave.deleteUser(); }\n",
        'UserDetails.js: dead wrapper tail')
    if ch:
        with open(UD, 'wb') as fh:
            fh.write(ud)
        print("  [write] UserDetails.js: dead wrappers removed")

    # ---- 4. CreateTicket.js (CRLF) ----
    ct = open(CT, 'rb').read()
    ct, ch = remove_lines(ct, [
        b"function SubmitCreatedTicket() { page.submitTicket(); }\r\n",
        b"function selector1DropDown() { page._onRequestTypeChange(); }\r\n",
    ], 'CreateTicket.js: dead wrapper lines')
    if ch:
        with open(CT, 'wb') as fh:
            fh.write(ct)
        print("  [write] CreateTicket.js: dead wrappers removed")
    else:
        print("  [skip] CreateTicket.js: already clean")

    print("Done.")


if __name__ == '__main__':
    main()
