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

            MessageBox.show('User has been updated', 'UserPage');

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

            MessageBox.show('User has been updated', 'UserPage');

        } catch (error) {
            if (error.message !== 'Unauthorized') {
                this.handleError("Error: Couldn't manage user.");
            }
        }
    }

    // -------------------------  Reset  ------------------------- //

    confirmReset() {
        MessageBox.confirm(
            'Are you sure you want to reset the password and pin for this user?',
            () => userSave.resetUser()
        );
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

    confirmDelete() {
        MessageBox.confirm(
            'Are you sure you want to delete this user?',
            () => userSave.deleteUser()
        );
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
