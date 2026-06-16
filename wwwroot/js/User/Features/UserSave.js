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

    async updateUser() {
        try {
            const phone = document.getElementById('UserPhone')?.value;
            const userLogin = document.getElementById('UserEmail')?.innerText;

            await API.post('User/UpdateUser', API.authPayload({
                userLogin,
                phone
            }));

            MessageBox.show('User has been updated', 'UserDetails');

        } catch (error) {
            if (error.message !== 'Unauthorized') {
                this.handleError("Error: Couldn't update user.");
            }
        }
    }

    async manageUser() {
        try {
            const phone = document.getElementById('UserPhone')?.value;
            const userLogin = document.getElementById('UserEmail')?.innerText;
            // ManageUserRequest declares these as C# strings; STJ rejects JSON
            // numbers for string props (400), so send the raw select values.
            const unlockUser = document.getElementById('Locked')?.value || '0';
            const adminLevelId = document.getElementById('AdminLevel')?.value || '0';

            await API.post('User/ManageUser', API.authPayload({
                userLogin,
                unlockUser,
                adminLevelId,
                phone
            }));

            MessageBox.show('User has been updated', 'UserDetails');

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
            const userLogin = document.getElementById('UserEmail')?.innerText;
            const phone = document.getElementById('UserPhone')?.value;
            const adminLevelId = document.getElementById('AdminLevel')?.value || '0';

            await API.post('User/ManageUser', API.authPayload({
                userLogin,
                unlockUser: '0',
                adminLevelId,
                phone
            }));

            MessageBox.show('User has been reactivated', 'UserPage');

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
            const userLogin = document.getElementById('UserEmail')?.innerText;
            const phone = document.getElementById('UserPhone')?.value;
            const adminLevelId = document.getElementById('AdminLevel')?.value || '0';

            await API.post('User/ManageUser', API.authPayload({
                userLogin,
                unlockUser: '0',
                adminLevelId,
                phone
            }));

            MessageBox.show('User has been unlocked', 'UserDetails');

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
            const userLogin = document.getElementById('UserEmail')?.innerText;

            const data = await API.post('User/ResetUser',
                API.authPayload({ userLogin })
            );

            MessageBox.show(`Reset ${data}`, 'UserPage');

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
            const userLogin = document.getElementById('UserEmail')?.innerText;

            const data = await API.post('User/DeleteUser',
                API.authPayload({ userLogin })
            );

            MessageBox.show(data, 'UserPage');

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
