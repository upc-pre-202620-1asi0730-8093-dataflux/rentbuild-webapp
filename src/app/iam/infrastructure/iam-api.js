import { PasswordRecoveryApiEndpoint } from "./password-recovery-api-endpoint.js";
import { resolve } from "../../shared/infrastructure/services.js";

import { SIGN_IN_PORT } from "./sign-in.port.js";
import { SignUpApiEndpoint } from "./sign-up-api-endpoint.js";
export class IamApi {
  #signInEndpoint = resolve(SIGN_IN_PORT);
  #signUpEndpoint = resolve(SignUpApiEndpoint);
  recoverPassword(command) {
    return resolve(PasswordRecoveryApiEndpoint).requestRecovery(command);
  }
  signIn(signInCommand) {
    return this.#signInEndpoint.signIn(signInCommand);
  }
  signUp(signUpCommand) {
    return this.#signUpEndpoint.signUp(signUpCommand);
  }
}