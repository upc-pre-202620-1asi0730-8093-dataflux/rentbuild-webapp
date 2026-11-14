import {
    resolve,
    sessionEnded,
    HttpClient,
} from "../../shared/infrastructure/services.js";
import { environment } from "../../../environments/environment.js";
const passwordRecoveryUrl = `${environment.platformProviderApiBaseUrl}${environment.platformProviderPasswordRecoveryEndpointPath}`;
/** HTTP adapter: the backend owns tokens, account lookup and SendGrid integration. */
export class PasswordRecoveryApiEndpoint {
    http = resolve(HttpClient);
    requestRecovery(command) {
        return this.http.post(passwordRecoveryUrl, { email: command.email });
    }
}
