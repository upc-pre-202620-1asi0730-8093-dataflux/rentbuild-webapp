import { shallowRef, shallowReadonly, computed } from "vue";
import { takeUntil } from "rxjs";
import { defineStore } from "pinia";
import {
    registerStore,
    exposeStore,
} from "../../shared/infrastructure/services.js";
import {
    resolve,
    sessionEnded,
    HttpClient,
} from "../../shared/infrastructure/services.js";
import { EquipmentHistoryApiEndpoint } from "../infrastructure/equipment-history-api-endpoint.js";
export class EquipmentHistoryStore {
    #api = resolve(EquipmentHistoryApiEndpoint);
    #loadVersion = 0;
    #history = shallowRef(null);
    history = shallowReadonly(this.#history);
    #loading = shallowRef(false);
    loading = shallowReadonly(this.#loading);
    #errorKey = shallowRef(null);
    errorKey = shallowReadonly(this.#errorKey);
    clear() {
        ++this.#loadVersion;
        this.#history.value = null;
        this.#loading.value = false;
        this.#errorKey.value = null;
    }
    load(equipmentId) {
        const version = ++this.#loadVersion;
        this.#history.value = null;
        this.#errorKey.value = null;
        if (!Number.isInteger(equipmentId) || equipmentId <= 0) {
            this.#loading.value = false;
            this.#errorKey.value = "maintenance.history.invalid-id";
            return;
        }
        this.#loading.value = true;
        this.#api
            .getByEquipmentId(equipmentId)
            .pipe(takeUntil(sessionEnded))
            .subscribe({
                next: (history) => {
                    if (version !== this.#loadVersion) return;
                    this.#history.value = history;
                    this.#loading.value = false;
                },
                error: (error) => {
                    if (version !== this.#loadVersion) return;
                    this.#loading.value = false;
                    if (typeof error?.status === "number" && error.status === 404) {
                        this.#errorKey.value = "maintenance.history.not-found";
                    } else if (
                        typeof error?.status === "number" &&
                        error.status === 403
                    ) {
                        this.#errorKey.value = "maintenance.history.forbidden";
                    } else {
                        this.#errorKey.value = "maintenance.history.load-error";
                    }
                },
            });
    }
}

export const useEquipmentHistoryStore = defineStore("equipmenthistory", () =>
    exposeStore(new EquipmentHistoryStore()),
);
registerStore(EquipmentHistoryStore, useEquipmentHistoryStore);
