import {
    resolve,
    sessionEnded,
    HttpClient,
} from "../../shared/infrastructure/services.js";
import { map } from "rxjs";
import { environment } from "../../../environments/environment.js";
import { EquipmentHistoryAssembler } from "./equipment-history-assembler.js";
export class EquipmentHistoryApiEndpoint {
    #http = resolve(HttpClient);
    #assembler = new EquipmentHistoryAssembler();
    #maintenancesUrl = `${environment.platformProviderApiBaseUrl}${environment.platformProviderMaintenancesEndpointPath}`;
    getByEquipmentId(equipmentId) {
        if (!Number.isInteger(equipmentId) || equipmentId <= 0) {
            throw new Error("Invalid equipment identifier");
        }
        return this.#http
            .get(`${this.#maintenancesUrl}/equipment/${equipmentId}/history`)
            .pipe(
                map((resource) => {
                    if (resource.equipmentId !== equipmentId) {
                        throw new Error(
                            "Equipment history response does not match the requested equipment",
                        );
                    }
                    return this.#assembler.toEntity(resource);
                }),
            );
    }
}
