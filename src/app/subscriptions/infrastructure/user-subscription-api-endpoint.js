import { map, catchError } from "rxjs";
import { environment } from "../../../environments/environment.js";
import { BaseApiEndpoint } from "../../shared/infrastructure/base-api-endpoint.js";

import { UserSubscriptionAssembler } from "./user-subscription-assembler.js";
export class UserSubscriptionApiEndpoint extends BaseApiEndpoint {
  cancel(id) {
    return this.http.patch(`${this.endpointUrl}/${id}/cancel`, {}).pipe(
      map((r) => this.assembler.toEntityFromResource(r)),
      catchError(this.handleError("Failed to cancel subscription")),
    );
  }
  constructor(http) {
    super(
      http,
      `${environment.platformProviderApiBaseUrl}/user-subscriptions`,
      new UserSubscriptionAssembler(),
    );
  }
}
