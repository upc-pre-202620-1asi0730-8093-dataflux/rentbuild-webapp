import { QueryParams } from "../../shared/infrastructure/services.js";

import { catchError, map } from "rxjs/operators";
import { BaseApiEndpoint } from "../../shared/infrastructure/base-api-endpoint.js";
import { environment } from "../../../environments/environment.js";

import { EquipmentAssembler } from "./equipment-assembler.js";
export class EquipmentApiEndpoint extends BaseApiEndpoint {
  getAvailability(id, period) {
    // Date input values are local calendar days. Avoid toISOString(), which can
    // shift the date when the browser's timezone is not UTC.
    const calendarDay = (date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const params = new QueryParams()
        .set("startDate", calendarDay(period.startDate))
        .set("endDate", calendarDay(period.endDate));
    return this.http
        .get(`${this.endpointUrl}/${id}/availability`, { params })
        .pipe(
            map((response) => {
              if (!response || typeof response.available !== "boolean") {
                throw new Error("Invalid equipment availability response");
              }
              return response.available;
            }),
            catchError(this.handleError("Failed to check equipment availability")),
        );
  }

  constructor(http) {
    super(
        http,
        `${environment.platformProviderApiBaseUrl}${environment.platformProviderEquipmentEndpointPath}`,
        new EquipmentAssembler(),
    );
  }
  patchEditableFields(equipment) {
    if (!Number.isInteger(equipment.id) || equipment.id <= 0) {
      throw new Error("Invalid equipment identifier");
    }
    const editable = {
      code: equipment.code,
      name: equipment.name,
      description: equipment.description,
      categoryId: equipment.categoryId,
      location: equipment.location,
      dailyRate: equipment.rentalRate.dailyRate,
      weeklyRate: equipment.rentalRate.weeklyRate,
      currency: equipment.rentalRate.currency,
    };
    return this.http
        .patch(`${this.endpointUrl}/${equipment.id}`, editable)
        .pipe(
            map((resource) => this.assembler.toEntityFromResource(resource)),
            catchError(
                this.handleError("Failed to update editable equipment fields"),
            ),
        );
  }
  getByUserId(userId) {
    const params = new QueryParams().set("userId", userId.toString());
    return this.http
        .get(this.endpointUrl, {
          params,
        })
        .pipe(
            map((response) => {
              const resources = Array.isArray(response)
                  ? response
                  : response.equipments;
              return resources.map((resource) =>
                  this.assembler.toEntityFromResource(resource),
              );
            }),
            catchError(this.handleError("Failed to fetch equipment by user id")),
        );
  }
}
