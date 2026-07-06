// =============================  UserSave.js  ============================= //
// Write operations for the user detail page: update / manage / reset / delete.
// Extracted from UserManager (Phase 6) into its own class so the orchestrator
// stays focused on init + layout. Exposed as the global `userSave`, which the
// orchestrator wires the action buttons to and the confirm dialogs call back into.

'use strict';

class UserSave extends PageBase {

    constructor() {
        super();
    }

    // -------------------------  Update  ------------------------- //

    // One gate for every op: the stored login key must be a real value.
    // Null (cleared), '' or the literal 'undefined'/'null' (legacy bad
    // writes) all mean this account has no usable login to key on.
    _requireLogin() {
        const v = sessionStorage.getItem(STORAGE_KEYS.VIEW_USER_LOGIN);
        if (v && v !== 'undefined' && v !== 'null') return v;
        MessageBox.show('This account has no login to operate on \u2014 it may have been scrubbed or deactivated.');
        return null;
    }

    async updateUser() {
        try {
            const phone = document.getElementById('UserPhone')?.value;
            const userLogin = this._requireLogin();
            if (!userLogin) return;

            await API.post('User/UpdateUser', API.authPayload({
                userLogin,
                phone
            }));

            UI.flash?.('User has been updated', 'success');
            Router.toUserDetails();

        } catch (error) {
            if (error.message !== 'Unauthorized') {
                this.handleError("Error: Couldn't update user.");
            }
        }
    }

    async manageUser() {
        try {
            // HD40 7b: phone must be a valid format when provided.
            const phoneInput = document.getElementById('UserPhone');
            if (phoneInput && !Form.isValidPhone(phoneInput.value)) {
                phoneInput.classList.add('field-invalid');
                phoneInput.focus();
                UI.toast?.('Please enter a valid phone number', 'warning');
                return;
            }
            const phone = document.getElementById('UserPhone')?.value;
            const userLogin = this._requireLogin();
            if (!userLogin) return;
            // ManageUserRequest declares these as C# strings; STJ rejects JSON
            // numbers for string props (400), so send the raw select values.
            //
            // Lock state: the main Save must NOT touch it. usp_Helpdesk_UserManage
            // unlocks on ANY @UnlockUser value (including 0) and only leaves the
            // lock alone when @UnlockUser is NULL -- so we OMIT unlockUser here.
            // (The controller now maps an absent value to NULL, not 0.) Only the
            // dedicated Unlock button sends a value. HD35 locked-user fix.
            const adminLevelId = document.getElementById('AdminLevel')?.value || '0';

            await API.post('User/ManageUser', API.authPayload({
                userLogin,
                adminLevelId,
                phone
            }));

            UI.flash?.('User has been updated', 'success');
            Router.toUserDetails();

        } catch (error) {
            if (error.message !== 'Unauthorized') {
                this.handleError("Error: Couldn't manage user.");
            }
        }
    }

    // -------------------------  Activate  ------------------------- //

    async confirmActivate() {
        const ok = await Confirm.ask({
            title: 'Reactivate user',
            message: 'Reactivate this user? They will be able to sign in again.',
            confirmText: 'Reactivate',
        });
        if (ok) this.activateUser();
    }

    async activateUser() {
        UI.toggleWaiting();
        try {
            const userLogin = this._requireLogin();
            if (!userLogin) return;
            const phone = document.getElementById('UserPhone')?.value;
            const adminLevelId = document.getElementById('AdminLevel')?.value || '0';

            // Reactivating a deactivated account must not also clear a lock;
            // omit unlockUser so @UnlockUser arrives NULL. HD35 locked-user fix.
            await API.post('User/ManageUser', API.authPayload({
                userLogin,
                adminLevelId,
                phone
            }));

            UI.flash?.('User has been reactivated', 'success');
            Router.toUserPage();

        } catch (error) {
            if (error.message !== 'Unauthorized') {
                this.handleError("Error: Couldn't reactivate user.");
            }
        } finally {
            UI.toggleWaiting();
        }
    }

    // Unlock a locked account. The UserManage proc treats any @UnlockUser
    // value as 'unlock' (sets UserLocked = 0), so we send '0' and reload.
    async unlockUser() {
        UI.toggleWaiting();
        try {
            const userLogin = this._requireLogin();
            if (!userLogin) return;
            const phone = document.getElementById('UserPhone')?.value;
            const adminLevelId = document.getElementById('AdminLevel')?.value || '0';

            // Send a value (any non-null works; '1' = "do unlock") so the proc
            // clears the lock. HD35 locked-user fix.
            await API.post('User/ManageUser', API.authPayload({
                userLogin,
                unlockUser: '1',
                adminLevelId,
                phone
            }));

            UI.flash?.('User has been unlocked', 'success');
            Router.toUserDetails();

        } catch (error) {
            if (error.message !== 'Unauthorized') {
                this.handleError("Error: Couldn't unlock user.");
            }
        } finally {
            UI.toggleWaiting();
        }
    }

    // -------------------------  Reset  ------------------------- //

    async confirmReset() {
        const ok = await Confirm.ask({
            title: 'Reset credentials',
            message: 'Reset the password and pin for this user?',
            confirmText: 'Reset',
            danger: true,
        });
        if (ok) this.resetUser();
    }

    async resetUser() {
        UI.toggleWaiting();
        try {
            const userLogin = this._requireLogin();
            if (!userLogin) return;

            const data = await API.post('User/ResetUser',
                API.authPayload({ userLogin })
            );

            const raw = (typeof data === 'string') ? data.trim() : String(data ?? '');
            const [pin, tempPass] = raw.split('|');
            const msg = (/^\d+$/.test(pin) && tempPass)
                ? `Password and PIN reset.\n\nNew PIN: ${pin}\n\nTemporary password: ${tempPass}\n\nGive both to the user. They'll be asked to set a new password on next login.`
                : `Reset ${data}`;
            MessageBox.show(msg, 'UserPage');

        } catch (error) {
            if (error.message !== 'Unauthorized') {
                this.handleError("Error: Couldn't reset user.");
            }
        } finally {
            UI.toggleWaiting();
        }
    }

    // -------------------------  Delete  ------------------------- //

    async confirmDelete() {
        const ok = await Confirm.ask({
            title: 'Deactivate user',
            message: 'Deactivate this user? They will no longer be able to sign in.',
            confirmText: 'Deactivate',
            danger: true,
        });
        if (ok) this.deleteUser();
    }

    async deleteUser() {
        UI.toggleWaiting();
        try {
            const userLogin = this._requireLogin();
            if (!userLogin) return;

            const data = await API.post('User/DeleteUser',
                API.authPayload({ userLogin })
            );

            UI.flash?.(data, 'success');
            Router.toUserPage();

        } catch (error) {
            if (error.message !== 'Unauthorized') {
                this.handleError("Error: Couldn't delete user.");
            }
        } finally {
            UI.toggleWaiting();
        }
    }
}

const userSave = new UserSave();

if (typeof window !== 'undefined') {
    window.userSave = userSave;
}
