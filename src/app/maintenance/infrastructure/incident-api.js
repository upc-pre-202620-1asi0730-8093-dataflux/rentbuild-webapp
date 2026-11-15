import { BaseApi } from "../../shared/infrastructure/base-api.js";

import { IncidentApiEndpoint } from "./incident-api-endpoint.js";
export class IncidentApi extends BaseApi {
  reactivateEquipment(equipmentId, inspectionConfirmed) {
    return this.#incidentEndpoint.reactivateEquipment(
        equipmentId,
        inspectionConfirmed,
    );
  }

  #incidentEndpoint = new IncidentApiEndpoint(this.http);
  getIncidents() {
    return this.#incidentEndpoint.getAll();
  }
  createIncident(incident) {
    return this.#incidentEndpoint.create(incident);
  }
  resolveIncident(incident) {
    return this.#incidentEndpoint.resolveIncident(incident);
  }
  requireRentalRestriction(incident) {
    return this.#incidentEndpoint.requireRentalRestriction(incident);
  }
}
