#!/usr/bin/env python3
"""
CSS cleanup Phase 1 -- go CSS-only.

Removes the 20 orphaned .less source files and the one dead .css:

  - All wwwroot/css/**/*.less. Nothing loads .less (no <link> references it, no
    build step compiles it -- there is no gulp/webpack/bundle config), so these
    files contribute nothing at runtime. Deleting them cannot change rendering.
  - wwwroot/css/Pages/Admin.css -- the Admin area was retired earlier; there are
    no Admin views and no <link> references this file, so it is dead too.

It also drops the now-dead static-file MIME mapping in Program.cs that served
.less as text/css (provider.Mappings[".less"] = "text/css";). With no .less files
left, nothing is served through it. The .js/.mjs mappings are left intact.
(C# change -- build to confirm, though it is a single-line mapping removal.)

This intentionally does NOT change any loaded .css, so on-screen output is
unchanged. A handful of selectors used in views had rules ONLY in .less and were
never carried into a loaded .css (so they are already unstyled in production);
those are reported separately for a restore decision rather than silently ported
here (porting would change live appearance and needs visual QA).

Idempotent: re-running is safe (missing files are skipped).
"""
import os, sys

REMOVE = [
    # --- orphaned .less sources ---
    'wwwroot/css/Addons/Attachment.less',
    'wwwroot/css/Addons/FilterBox.less',
    'wwwroot/css/Addons/FormLayout.less',
    'wwwroot/css/Addons/NotesTable.less',
    'wwwroot/css/Addons/PopupWindows.less',
    'wwwroot/css/Addons/Queue.less',
    'wwwroot/css/Addons/TableLayout.less',
    'wwwroot/css/Core/Variables.less',
    'wwwroot/css/Layout/Template.less',
    'wwwroot/css/Pages/Admin.less',
    'wwwroot/css/Pages/CreateForm.less',
    'wwwroot/css/Pages/Details.less',
    'wwwroot/css/Pages/Login.less',
    'wwwroot/css/Pages/RFC.less',
    'wwwroot/css/Pages/StatsPage.less',
    'wwwroot/css/Pages/TeamPage.less',
    'wwwroot/css/Pages/TicketBox.less',
    'wwwroot/css/Pages/TicketDetails.less',
    'wwwroot/css/Pages/TicketPage.less',
    'wwwroot/css/Pages/UserDetails.less',
    # --- dead .css (Admin area retired; unreferenced) ---
    'wwwroot/css/Pages/Admin.css',
]


def _edit_program_cs(root):
    """Remove the now-dead `.less` -> text/css static-file MIME mapping."""
    path = os.path.join(root, 'Program.cs')
    if not os.path.exists(path):
        print("  (absent) Program.cs")
        return
    data = open(path, 'rb').read()
    forms = [b'provider.Mappings[".less"] = "text/css";\r\n',
             b'provider.Mappings[".less"] = "text/css";\n']
    total = sum(data.count(f) for f in forms)
    if total == 0:
        print("  (absent) Program.cs .less MIME mapping")
        return
    assert total == 1, f"expected exactly one .less MIME mapping, found {total}"
    for f in forms:
        if f in data:
            data = data.replace(f, b'', 1)
            break
    with open(path, 'wb') as fh:
        fh.write(data)
    print("  edited   Program.cs (removed .less MIME mapping)")


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else '.'
    removed = 0
    for rel in REMOVE:
        full = os.path.join(root, rel)
        if os.path.exists(full):
            os.remove(full)
            removed += 1
            print(f"  removed  {rel}")
        else:
            print(f"  (absent) {rel}")
    _edit_program_cs(root)
    # tidy up Core/ if it is now empty (only held Variables.less)
    core = os.path.join(root, 'wwwroot/css/Core')
    if os.path.isdir(core) and not os.listdir(core):
        os.rmdir(core)
        print("  rmdir    wwwroot/css/Core (now empty)")
    print(f"Done. Removed {removed} file(s).")


if __name__ == '__main__':
    main()
