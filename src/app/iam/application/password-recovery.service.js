import {
    resolve,
    sessionEnded,
    HttpClient,
} from "../../shared/infrastructure/services.js";
import { IamApi } from "../infrastructure/iam-api.js";
/** Application orchestration; no mail provider or password logic runs in Vue. */
export class PasswordRecoveryService {
    iamApi = resolve(IamApi);
    requestRecovery(command) {
        return this.iamApi.recoverPassword(command);
    }
}
