// =============================  Login Status Codes  ============================= //
// Fix: named constants — replaces magic numbers throughout
const LOGIN_STATUS = {
    SUCCESS: 0,
    PASSWORD_UPDATED: 1,
    DEFAULT_PASSWORD: 10,
    INVALID_CREDENTIALS: 95,
    ACCOUNT_LOCKED_ATTEMPTS: 96,
    NO_DEFAULT_PASSWORD: 97,
    ACCOUNT_LOCKED: 98,
    INVALID_CREDENTIALS_2: 99
};

// =============================  Init  ============================= //
window.onload = function () {
    sessionStorage.clear();
    sessionStorage.setItem("LoginPage", 1);

    are_cookies_enabled();
    CreatePinBoxes();

    document.getElementById("nav").innerHTML = "";

    // Fix: wire up events removed from HTML
    document.getElementById("Login-Button")?.addEventListener("click", () => Login(document.getElementById("login")));
    document.getElementById("SecondWall-Submit")?.addEventListener("click", SecondWallAuth);
    document.getElementById("NewPass-Submit")?.addEventListener("click", () => SetNewPassword(document.getElementById("NewPass")));
    document.getElementById("pass")?.addEventListener("keydown", e => { if (e.key === "Enter") Login(document.getElementById("login")); });

    // Hold the eye button to reveal the password; release to hide again.
    const peekBtn = document.getElementById("pass-peek");
    const passField = document.getElementById("pass");
    if (peekBtn && passField) {
        const reveal  = () => { passField.type = "text";     peekBtn.classList.add("is-peeking"); };
        const conceal = () => { passField.type = "password"; peekBtn.classList.remove("is-peeking"); };
        peekBtn.addEventListener("pointerdown", e => { e.preventDefault(); reveal(); });
        ["pointerup", "pointerleave", "pointercancel"].forEach(ev => peekBtn.addEventListener(ev, conceal));
        window.addEventListener("blur", conceal);
    }    
};


// =============================  Login Functions  ============================= //

// Captured at the first DEFAULT_PASSWORD response so the new-password submit
// re-sends the user's actual default (e.g. "Helpdesk7741"), not a fixed string.
let defaultPassword = "";
// Set when the first password wall reports a default/temp password (status 10).
// The new password must be set AFTER the PIN, so we only flag it here and show the
// reset form once the PIN has verified. pinVerified gates that post-PIN step.
let mustChangePassword = false;
let pinVerified = false;

// Redirect into the app after both walls pass: RFC-only users (level 4) -> RFC,
// everyone else -> TicketPage.
function enterApp() {
    const destination = sessionStorage.getItem("Admin") === "4" ? "RFC" : "TicketPage";
    OkayButtonPress(destination);
}

async function Login(form, e) {
    ToggleWaiting();

    const LoginForm = document.getElementById("login");
    const NewPassForm = document.getElementById("NewPass");
    let pass = "";
    let newpass = "";
    let name = "";

    if (NewPassForm[0].value !== "") {
        newpass = NewPassForm.pass1.value;
        pass = defaultPassword || "Helpdesk";
    } else {
        pass = LoginForm.psw.value;
    }
    name = LoginForm.uname.value;
    if (!name || !pass) {
        ToggleWaiting();
        return;
    }

    const UTC = UTCWorkAround();

    try {
        const response = await fetch("/api/Login/PostLogin", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            // Fix: credentials in body — not headers
            body: JSON.stringify({
                userName: name,
                password: pass,
                newPassword: newpass || null,
                UTC: UTC
            })
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();

        sessionStorage.setItem("UserName", name);
        sessionStorage.setItem("UserID", data.userID);
        sessionStorage.setItem("AuthorityID", data.authorityID);

        if (data.status === LOGIN_STATUS.DEFAULT_PASSWORD) defaultPassword = pass;
        HandleStatusLogin(data.status);

    } catch (error) {
        console.error('Login error:', error);
        BuildMessageBox("Failed to Connect to server, please contact Govtech for assistance.", "Index");
    } finally {
        LoginForm.psw.value = "";
        const pass1 = document.getElementById("pass1");
        const pass2 = document.getElementById("pass2");
        if (pass1) pass1.value = "";
        if (pass2) pass2.value = "";
        ToggleWaiting();
    }
}

function HandleStatusLogin(status) {
    // Fix: named constants — not magic numbers
    switch (status) {
        case LOGIN_STATUS.SUCCESS:
            sessionStorage.setItem("Status", 0);
            break;

        case LOGIN_STATUS.PASSWORD_UPDATED:
            sessionStorage.setItem("Status", 0);
            if (pinVerified) {
                // New flow: the new password was set after the PIN -> enter the app.
                enterApp();
                return;
            }
            BuildMessageBox("Logged in & password updated");
            break;

        case LOGIN_STATUS.DEFAULT_PASSWORD:
            // Default/temp password is correct, but the new password must be
            // set AFTER the PIN. Flag it and continue to the PIN wall; the reset
            // form is shown only once the PIN verifies (in SecondWallAuth).
            mustChangePassword = true;
            sessionStorage.setItem("Status", 0);
            break;

        case LOGIN_STATUS.INVALID_CREDENTIALS:
        case LOGIN_STATUS.INVALID_CREDENTIALS_2:
            BuildMessageBox("Username or password incorrect", "Index");
            sessionStorage.setItem("Status", 1);
            return; // Fix: early return — don't show SecondWall on failure

        case LOGIN_STATUS.ACCOUNT_LOCKED_ATTEMPTS:
            BuildMessageBox("No. of login attempts exceeds maximum - account locked for security purposes", "Index");
            document.getElementById("pass").value = "";
            sessionStorage.setItem("Status", 1);
            return;

        case LOGIN_STATUS.NO_DEFAULT_PASSWORD:
            BuildMessageBox("User does not have a default password - please contact your system administrator", "Index");
            sessionStorage.setItem("Status", 1);
            return;

        case LOGIN_STATUS.ACCOUNT_LOCKED:
            BuildMessageBox("User locked - please contact your system administrator", "Index");
            document.getElementById("pass").value = "";
            sessionStorage.setItem("Status", 1);
            return;

        default:
            BuildMessageBox("An unexpected error occurred. Please try again.", "Index");
            sessionStorage.setItem("Status", 1);
            return;
    }
       
    document.getElementById("Login-Container").classList.remove("active");
    document.getElementById("SecondWall-Container").classList.add("active");
}

async function SecondWallAuth() {
    let status = sessionStorage.getItem("Status");
    let pin = '';
    let email = '';

    if (status === "1") {
        BuildMessageBox("Incorrect Credentials", "Index");
        return;
    }

    ToggleWaiting();

    email = sessionStorage.getItem("UserName");
    const pinBoxes = document.querySelectorAll("#Pin-Boxes input, #Pin-Boxes select");
    pin = Array.from(pinBoxes).map(b => b.value).join("");

    const UTC = UTCWorkAround();

    try {
        const response = await fetch("/api/Login/SecondWallAuth", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            // Fix: PIN + email in body — not headers
            // Fix: typed properties — not array indexes
            body: JSON.stringify({ email, pin: parseInt(pin), UTC })
        });

        if (response.status === 401) { BuildMessageBox("Incorrect PIN. Please try again.", "Index"); return; }
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();

        // Fix: named AuthResult properties — not data[0], data[1]
        if (data.isSuccess) {
            pinVerified = true;
            if (mustChangePassword) {
                // PIN verified: require the new password before entering the app.
                document.getElementById("SecondWall-Container").classList.remove("active");
                document.getElementById("ResetPassword-Container").classList.add("active");
                return;
            }
            enterApp();
        } else if (data.returnCode === LOGIN_STATUS.ACCOUNT_LOCKED) {
            BuildMessageBox("Incorrect Pin", "Index");
        } else {
            BuildMessageBox("Incorrect Credentials", "Index");
        }

    } catch (error) {
        console.error('SecondWallAuth error:', error);
        BuildMessageBox("Incorrect Credentials", "Index");
    } finally {
        ToggleWaiting();
    }
}

function SetNewPassword(form) {
    const pass1 = form.passretype1.value;
    const pass2 = form.passretype2.value;

    if (pass1 !== pass2) {
        BuildMessageBox("Password didn't match, please try again.");
        document.getElementById("pass1").value = "";
        document.getElementById("pass2").value = "";
        return;
    }

    const errors = [];
    if (pass1.length < 12) errors.push("Your password must be at least 12 characters");
    if (!/[a-z]/.test(pass1)) errors.push("Your password must contain at least one lowercase letter");
    if (!/[A-Z]/.test(pass1)) errors.push("Your password must contain at least one uppercase letter");
    if (!/[0-9]/.test(pass1)) errors.push("Your password must contain at least one digit");

    if (errors.length > 0) {
        BuildMessageBox(errors.join("\n"));
        document.getElementById("pass1").value = "";
        document.getElementById("pass2").value = "";
        return;
    }

    document.getElementById('ResetPassword-Container').style.display = 'none';
    Login(form);
}

// =============================  Misc Functions  ============================= //

function CreatePinBoxes() {
    const PinBoxes = document.getElementById("Pin-Boxes");

    // All six positions are plain digit inputs (the random dropdown tiles
    // were removed). One digit per box, auto-advancing as you type.
    for (let i = 1; i <= 6; i++) {
        PinBoxes.innerHTML += `<input type="tel" inputmode="numeric" size="1" maxlength="1" id="pin-${i}" aria-label="PIN digit ${i}" />`;
    }

    const boxAt = i => document.getElementById(`pin-${i}`);
    const indexOfBox = el => parseInt(el.id.slice(4), 10);
    const moveTo = i => { const b = boxAt(i); if (b) { b.focus(); b.select(); } };

    // Digits only; typing a digit moves focus to the next box.
    PinBoxes.addEventListener('input', e => {
        const box = e.target;
        if (!box.id || !box.id.startsWith('pin-')) return;
        box.value = box.value.replace(/[^0-9]/g, '').slice(0, 1);
        if (box.value) moveTo(indexOfBox(box) + 1);
    });

    // Backspace on an empty box steps back; Enter submits.
    PinBoxes.addEventListener('keydown', e => {
        const box = e.target;
        if (!box.id || !box.id.startsWith('pin-')) return;
        if (e.key === 'Backspace' && !box.value) moveTo(indexOfBox(box) - 1);
        if (e.key === 'Enter') document.getElementById('SecondWall-Submit')?.click();
    });

    // Pasting a full PIN fills the boxes in order.
    PinBoxes.addEventListener('paste', e => {
        const digits = (e.clipboardData?.getData('text') ?? '').replace(/[^0-9]/g, '').slice(0, 6);
        if (!digits) return;
        e.preventDefault();
        for (let i = 0; i < digits.length; i++) {
            const b = boxAt(i + 1);
            if (b) b.value = digits[i];
        }
        moveTo(Math.min(digits.length + 1, 6));
    });
}

function are_cookies_enabled() {
    if (navigator.cookieEnabled) {
        DisplayAndHideItemsByTagName("body", true);
    } else {
        DisplayAndHideItemsByTagName("body", false);
        window.cookieconsent_options = {
            message: "This website uses cookies to ensure you get the best experience on our website. Please enable them to continue.",
            dismiss: "Got it!",
            learnMore: "More info",
            link: null,
            theme: "dark-top"
        };
    }
}

function enter(form, e) {
    if (e.keyCode === 13) Login(form);
}

function IgnoreAlpha(e) {
    event.preventDefault();
}

