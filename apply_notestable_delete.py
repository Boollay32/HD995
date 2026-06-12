#!/usr/bin/env python3
"""
HD995 — remove the dead NotesTable.css stylesheet and its two stale links.

NotesTable.css is dead AND mis-themed:
  - Its only class selector, .StickyNote, is referenced NOWHERE in the app.
  - The rest are bare element selectors (table/th/td/body) with legacy hardcoded
    values (#ccc, #F4F6F8, black, font-family: Calibri) plus a stray
    @import of Google Fonts Roboto on every page that links it.
  - The two pages that link it (RFCDetails, TaskDetails) render NO <table> at
    all -- not in markup, not built in JS -- so the sheet styles nothing.

Removing it cannot change any rendered output (verified: zero tables on either
page, zero .StickyNote references anywhere). FormLayout.css is KEPT -- it styles
.History-Div, which History.js builds live for the History tab.

  Deleted:  wwwroot/css/Addons/NotesTable.css
  Links removed from: Views/Page/RFC/RFCDetails.cshtml, Views/Page/TaskDetails.cshtml

Use `git add -A` when committing (this deletes a file).

Idempotent. Usage:  python3 apply_notestable_delete.py [repo_root]  (default '.')
"""

import os
import sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else '.'
CSS = os.path.join(ROOT, 'wwwroot', 'css', 'Addons', 'NotesTable.css')
VIEWS = [
    os.path.join(ROOT, 'Views', 'Page', 'RFC', 'RFCDetails.cshtml'),
    os.path.join(ROOT, 'Views', 'Page', 'TaskDetails.cshtml'),
]

LINK = ('    <link rel="stylesheet" type="text/css" '
        'href="/css/Addons/NotesTable.css" asp-append-version="true" />\r\n')


def main():
    print("HD995 — delete dead NotesTable.css + links")
    print(f"  repo root: {os.path.abspath(ROOT)}")

    # remove the links first
    for v in VIEWS:
        if not os.path.exists(v):
            print(f"  [error] missing {v}")
            sys.exit(1)
        data = open(v, 'rb').read()
        b = LINK.encode('ascii')
        if b not in data:
            print(f"  [skip] {os.path.relpath(v, ROOT)}: link already removed")
            continue
        if data.count(b) != 1:
            print(f"  [error] {os.path.relpath(v, ROOT)}: link not unique; aborting")
            sys.exit(1)
        with open(v, 'wb') as fh:
            fh.write(data.replace(b, b''))
        print(f"  [write] {os.path.relpath(v, ROOT)}: NotesTable.css link removed")

    # delete the file
    if os.path.exists(CSS):
        os.remove(CSS)
        print(f"  [delete] {os.path.relpath(CSS, ROOT)}")
    else:
        print(f"  [skip] {os.path.relpath(CSS, ROOT)}: already deleted")

    print("Done.")
    print("  [note] commit with `git add -A` (file deletion to stage).")


if __name__ == '__main__':
    main()
