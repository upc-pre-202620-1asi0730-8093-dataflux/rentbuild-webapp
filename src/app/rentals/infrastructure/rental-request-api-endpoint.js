import { map } from "rxjs";
import { BaseApiEndpoint } from "../../shared/infrastructure/base-api-endpoint.js";
import { environment } from "../../../environments/environment.js";

import { RentalRequestAssembler } from "./rental-request-assembler.js";
export class RentalRequestApiEndpoint extends BaseApiEndpoint {
    reschedulePending(id, period) {
        return this.http
            .patch(`${this.endpointUrl}/${id}/period`, {
                startDate: period.startDate.toISOString(),
                endDate: period.endDate.toISOString(),
            })
            .pipe(map((resource) => this.assembler.toEntityFromResource(resource)));
    }

    constructor(http) {
        super(
            http,
            `${environment.platformProviderApiBaseUrl}${environment.platformProviderRentalRequestsEndpointPath}`,
            new RentalRequestAssembler(),
        );
    }
}
