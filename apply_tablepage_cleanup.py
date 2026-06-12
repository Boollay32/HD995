#!/usr/bin/env python3
"""
HD995 — Dead-code cleanup: the orphaned TablePage subsystem + dead Layout.js
wrappers. Every item verified to have ZERO live references.

TablePage was the generic-table page, superseded by the QueueView engine. It is
unreachable: PageController has no TablePage() action (so /Page/TablePage 404s)
and nothing links to it. Its whole dependency subsystem is used ONLY by it:

  Deleted files (each: zero non-TablePage references):
    Views/Page/TablePage.cshtml             orphan view (no route, no links)
    wwwroot/js/Shared/TablePage.js          no live callers
    wwwroot/js/Components/Table/TableManager.js   only TablePage.js used it
    wwwroot/js/Components/Filters/FilterManager.js only TablePage.js
    wwwroot/js/Components/Filters/FilterUI.js       only FilterManager.js
    Views/Shared/_FilterBox.cshtml          included only by TablePage.cshtml

  _Layout.cshtml: the 3 now-dead script tags removed (TableManager,
    FilterManager, FilterUI). QueueView.js sits between them and is KEPT
    (every list page uses it), so the tags are removed individually.

  STORAGE_KEYS.js: TABLE_PAGE_NAME removed (only TablePage.js read it).

  Layout.js dead legacy wrappers removed (zero callers; underlying Layout.*
  methods stay; CreateDynamicTable is KEPT -- StatsPage.js calls it):
    SetDetailContainerHeight, SetTableDimentionsAuto (typo),
    SetTableDimensionsAuto, SetHeaderWidths, ExpandFilter

KEPT (verified live): QueueView.js (all list pages), CreateDynamicTable
(StatsPage), Layout.setDetailContainerHeight method (RFCDetails/UserDetails).

Use `git add -A` when committing (this deletes files).

Idempotent. Usage:  python3 apply_tablepage_cleanup.py [repo_root]  (default '.')
"""

import os
import sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else '.'
P = lambda *a: os.path.join(ROOT, *a)

DELETE_FILES = [
    P('Views', 'Page', 'TablePage.cshtml'),
    P('wwwroot', 'js', 'Shared', 'TablePage.js'),
    P('wwwroot', 'js', 'Components', 'Table', 'TableManager.js'),
    P('wwwroot', 'js', 'Components', 'Filters', 'FilterManager.js'),
    P('wwwroot', 'js', 'Components', 'Filters', 'FilterUI.js'),
    P('Views', 'Shared', '_FilterBox.cshtml'),
]

LAYOUT = P('Views', 'Shared', '_Layout.cshtml')
SKEYS  = P('wwwroot', 'js', 'Core', 'STORAGE_KEYS.js')
LAYJS  = P('wwwroot', 'js', 'Core', 'Layout.js')

LAYOUT_TAGS = [
    '    <script src="~/js/Components/Table/TableManager.js" asp-append-version="true"></script>\r\n',
    '    <script src="~/js/Components/Filters/FilterManager.js" asp-append-version="true"></script>\r\n',
    '    <script src="~/js/Components/Filters/FilterUI.js" asp-append-version="true"></script>\r\n',
]

SKEY_LINE = "    TABLE_PAGE_NAME: 'TablePageName',\r\n"

# Layout.js dead wrapper lines (each removed if present)
LAYJS_LINES = [
    "function SetDetailContainerHeight() { Layout.setDetailContainerHeight(); }\r\n",
    "function SetTableDimentionsAuto() { Layout.setTableDimensions(); }\r\n",
    "function SetHeaderWidths(tableId = 'Table') { Layout.setHeaderWidths(tableId); }\r\n",
    "// ----- Stats page helpers (define previously-missing globals) ----- //\r\n",
    "function SetTableDimensionsAuto() { Layout.setTableDimensions(); }\r\n",
]
# ExpandFilter is a multi-line block -> remove by start/end markers
EXPAND_START = "// Expand / collapse the stats filter panel (also used by TablePage hover handlers).\r\n"
EXPAND_END = (
    "function ExpandFilter(expand) {\r\n"
    "    const box = document.getElementById('Filter-Box');\r\n"
    "    if (box) { box.classList.toggle('expanded', !!expand); box.classList.toggle('collapsed', !expand); }\r\n"
    "    const body = document.getElementById('Filter-Box-Body');\r\n"
    "    if (body) body.style.display = expand ? '' : 'none';\r\n"
    "}\r\n"
)


def remove_lines(data, lines, label):
    changed = False
    for ln in lines:
        b = ln.encode('ascii')
        if b in data:
            if data.count(b) != 1:
                print(f"  [error] {label}: line not unique; aborting\n    {ln[:50]!r}")
                sys.exit(1)
            data = data.replace(b, b'')
            changed = True
    return data, changed


def main():
    print("HD995 — TablePage subsystem + dead Layout wrappers cleanup")
    print(f"  repo root: {os.path.abspath(ROOT)}")

    # 1. delete the orphan subsystem files
    for f in DELETE_FILES:
        if os.path.exists(f):
            os.remove(f)
            print(f"  [delete] {os.path.relpath(f, ROOT)}")
        else:
            print(f"  [skip] {os.path.relpath(f, ROOT)}: already deleted")

    # 2. _Layout: remove the 3 dead script tags (individually; QueueView between them stays)
    if os.path.exists(LAYOUT):
        lay = open(LAYOUT, 'rb').read()
        lay, ch = remove_lines(lay, LAYOUT_TAGS, '_Layout.cshtml tags')
        if ch:
            with open(LAYOUT, 'wb') as fh:
                fh.write(lay)
            print("  [write] _Layout.cshtml: dead script tags removed")
        else:
            print("  [skip] _Layout.cshtml: tags already removed")

    # 3. STORAGE_KEYS: remove TABLE_PAGE_NAME
    if os.path.exists(SKEYS):
        sk = open(SKEYS, 'rb').read()
        sk, ch = remove_lines(sk, [SKEY_LINE], 'STORAGE_KEYS.js')
        if ch:
            with open(SKEYS, 'wb') as fh:
                fh.write(sk)
            print("  [write] STORAGE_KEYS.js: TABLE_PAGE_NAME removed")
        else:
            print("  [skip] STORAGE_KEYS.js: already removed")

    # 4. Layout.js: remove dead wrappers + ExpandFilter block
    if os.path.exists(LAYJS):
        lj = open(LAYJS, 'rb').read()
        lj, ch1 = remove_lines(lj, LAYJS_LINES, 'Layout.js wrappers')
        # ExpandFilter block (comment + function)
        ch2 = False
        s = lj.find(EXPAND_START.encode('ascii'))
        if s != -1:
            e = lj.find(EXPAND_END.encode('ascii'))
            if e == -1 or e < s:
                print("  [error] Layout.js: ExpandFilter end marker not found; aborting")
                sys.exit(1)
            lj = lj[:s] + lj[e + len(EXPAND_END.encode('ascii')):]
            ch2 = True
        if ch1 or ch2:
            with open(LAYJS, 'wb') as fh:
                fh.write(lj)
            print("  [write] Layout.js: dead wrappers + ExpandFilter removed")
        else:
            print("  [skip] Layout.js: already clean")

    print("Done.")
    print("  [note] commit with `git add -A` (file deletions to stage).")


if __name__ == '__main__':
    main()
