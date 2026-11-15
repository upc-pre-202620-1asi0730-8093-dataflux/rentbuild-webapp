import { map, catchError } from "rxjs";
import { environment } from "../../../environments/environment.js";
import { BaseApiEndpoint } from "../../shared/infrastructure/base-api-endpoint.js";

import { MaintenanceAssembler } from "./maintenance-assembler.js";
export class MaintenanceApiEndpoint extends BaseApiEndpoint {
  advanceMaintenance(maintenanceId, status, technician, notes) {
    const resource = {
      status,
      technician,
      acknowledge: false,
      notes,
    };
    return this.http
        .patch(`${this.endpointUrl}/${maintenanceId}`, resource)
        .pipe(
            map((response) => this.assembler.toEntityFromResource(response)),
            catchError(this.handleError("Failed to advance maintenance")),
        );
  }

  constructor(http) {
    super(
        http,
        `${environment.platformProviderApiBaseUrl}${environment.platformProviderMaintenancesEndpointPath}`,
        new MaintenanceAssembler(),
    );
  }
}
