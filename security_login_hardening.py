#!/usr/bin/env python3
"""
Login / auth security hardening.

1. wwwroot/js/Login/Pages/Login.js
   Removes the two `if (window.location.hostname === 'localhost')` branches that
   hardcoded a real user's email, password and PIN into client-side JS (readable
   by anyone who views source). The real input path (the former `else`) becomes
   the only path. ALSO rotate that account's password + PIN on the server.

2. Controllers/Login/LoginController.cs
   Stops PostLogin (the password stage, before the PIN) from returning
   `Token = user?.AuthenticationToken`. The client never used it; the real
   session token is issued by SecondWallAuth after the PIN. Status/UserID/
   AuthorityID are unchanged (the client reads those).

3. Program.cs
   - Enables app.UseHttpsRedirection() (was commented out) so http requests are
     redirected before any body is processed. NOTE: if TLS terminates at a proxy
     / load balancer, also configure forwarded headers, and verify in staging to
     avoid redirect loops.
   - Adds conservative security response headers (X-Content-Type-Options,
     X-Frame-Options, Referrer-Policy) early in the pipeline. (No CSP here -- that
     needs per-page tuning; add separately.)

C# changes -- build to confirm. Idempotent: safe to re-run.
"""
import sys

L  = 'wwwroot/js/Login/Pages/Login.js'
LC = 'Controllers/Login/LoginController.cs'
PG = 'Program.cs'

# ---- Login.js: branch #1 (Login) ----
OLD_L1 = (b"if (window.location.hostname === 'localhost') {\r\n"
          b"        // DEV ONLY \x97 remove before commit\r\n"
          b"        name = 'alex.bull@govtech.co.uk';\r\n"
          b"        pass = '(Qundai214620!)';\r\n"
          b"    } else {\r\n"
          b"        if (NewPassForm[0].value !== \"\") {\r\n"
          b"            newpass = NewPassForm.pass1.value;\r\n"
          b"            pass = \"Helpdesk\";\r\n"
          b"        } else {\r\n"
          b"            pass = LoginForm.psw.value;\r\n"
          b"        }\r\n"
          b"        name = LoginForm.uname.value;\r\n"
          b"        if (!name || !pass) {\r\n"
          b"            ToggleWaiting();\r\n"
          b"            return;\r\n"
          b"        }\r\n"
          b"    }\r\n\r\n    ")
NEW_L1 = (b"if (NewPassForm[0].value !== \"\") {\r\n"
          b"        newpass = NewPassForm.pass1.value;\r\n"
          b"        pass = \"Helpdesk\";\r\n"
          b"    } else {\r\n"
          b"        pass = LoginForm.psw.value;\r\n"
          b"    }\r\n"
          b"    name = LoginForm.uname.value;\r\n"
          b"    if (!name || !pass) {\r\n"
          b"        ToggleWaiting();\r\n"
          b"        return;\r\n"
          b"    }\r\n\r\n    ")

# ---- Login.js: branch #2 (SecondWallAuth) ----
OLD_L2 = (b"if (window.location.hostname === 'localhost') {\r\n"
          b"        email = 'alex.bull@govtech.co.uk';\r\n"
          b"        pin = '526826';\r\n"
          b"    }\r\n"
          b"    else{\r\n"
          b"        if (status === \"1\") {\r\n"
          b"            BuildMessageBox(\"Incorrect Credentials\", \"Index\");\r\n"
          b"            return;\r\n"
          b"        }\r\n\r\n"
          b"        ToggleWaiting();\r\n\r\n"
          b"        email = sessionStorage.getItem(\"UserName\");\r\n"
          b"        const pinBoxes = document.querySelectorAll(\"#Pin-Boxes input, #Pin-Boxes select\");\r\n"
          b"        pin = Array.from(pinBoxes).map(b => b.value).join(\"\");\r\n"
          b"    }\r\n    \r\n    ")
NEW_L2 = (b"if (status === \"1\") {\r\n"
          b"        BuildMessageBox(\"Incorrect Credentials\", \"Index\");\r\n"
          b"        return;\r\n"
          b"    }\r\n\r\n"
          b"    ToggleWaiting();\r\n\r\n"
          b"    email = sessionStorage.getItem(\"UserName\");\r\n"
          b"    const pinBoxes = document.querySelectorAll(\"#Pin-Boxes input, #Pin-Boxes select\");\r\n"
          b"    pin = Array.from(pinBoxes).map(b => b.value).join(\"\");\r\n\r\n    ")

# ---- LoginController.cs: drop the token from the password-stage response ----
OLD_LC = b"\r\n                Token = user?.AuthenticationToken,\r\n"
NEW_LC = b"\r\n"

# ---- Program.cs: enable https redirect ----
OLD_PG1 = b"//app.UseHttpsRedirection();\r\n"
NEW_PG1 = b"app.UseHttpsRedirection();\r\n"

# ---- Program.cs: add security headers right after the redirect ----
OLD_PG2 = b"app.UseHttpsRedirection();\r\n"
NEW_PG2 = (b"app.UseHttpsRedirection();\r\n\r\n"
           b"app.Use(async (context, next) =>\r\n"
           b"{\r\n"
           b"    var headers = context.Response.Headers;\r\n"
           b"    headers[\"X-Content-Type-Options\"] = \"nosniff\";\r\n"
           b"    headers[\"X-Frame-Options\"] = \"SAMEORIGIN\";\r\n"
           b"    headers[\"Referrer-Policy\"] = \"strict-origin-when-cross-origin\";\r\n"
           b"    await next();\r\n"
           b"});\r\n")

# Each edit carries a `done` marker whose PRESENCE means "already applied"
# (checked first). Where removal/uncommenting leaves no positive marker, `done`
# is None and absence of `old` is treated as already-applied.
EDITS = [
    (L,  OLD_L1, NEW_L1, "Login.js: remove hardcoded creds (Login)", NEW_L1),
    (L,  OLD_L2, NEW_L2, "Login.js: remove hardcoded creds (SecondWallAuth)", NEW_L2),
    (LC, OLD_LC, NEW_LC, "LoginController.cs: stop returning Token at password stage", None),
    (PG, OLD_PG1, NEW_PG1, "Program.cs: enable UseHttpsRedirection", None),
    (PG, OLD_PG2, NEW_PG2, "Program.cs: add security headers", b'X-Content-Type-Options'),
]


def main():
    import os
    root = sys.argv[1] if len(sys.argv) > 1 else '.'
    for rel, old, new, label, done in EDITS:
        path = os.path.join(root, rel)
        data = open(path, 'rb').read()
        if done is not None and done in data:
            print(f"  (already) {label}")
            continue
        if old in data:
            assert data.count(old) == 1, f"{label}: expected 1 anchor, found {data.count(old)}"
            data = data.replace(old, new, 1)
            open(path, 'wb').write(data)
            print(f"  applied   {label}")
        elif done is None:
            # nothing to remove/uncomment -> already done
            print(f"  (already) {label}")
        else:
            print(f"  !! ANCHOR NOT FOUND: {label}", file=sys.stderr)
            sys.exit(2)
    print("Done.")


if __name__ == '__main__':
    main()
