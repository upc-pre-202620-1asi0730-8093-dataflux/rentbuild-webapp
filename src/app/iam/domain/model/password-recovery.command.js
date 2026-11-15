/** Command used to request password recovery without exposing account existence. */
export class PasswordRecoveryCommand {
    email;
    constructor(email) {
        this.email = email;
    }
}
