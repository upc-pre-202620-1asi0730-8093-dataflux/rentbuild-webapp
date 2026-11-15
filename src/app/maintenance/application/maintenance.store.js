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
import { forkJoin, map } from "rxjs";
import { Maintenance } from "../domain/model/maintenance.entity.js";
import { MaintenanceStatus } from "../domain/model/maintenance-status.enum.js";
import { MaintenanceApi } from "../infrastructure/maintenance-api.js";
import { MAINTENANCE_EQUIPMENT_INFORMATION_PORT } from "../infrastructure/equipment-information.port.js";
export class MaintenanceStore {
  #maintenanceApi = resolve(MaintenanceApi);
  #equipmentInformation = resolve(MAINTENANCE_EQUIPMENT_INFORMATION_PORT);
  #loadVersion = 0;
  #maintenancesSignal = shallowRef([]);
  maintenances = shallowReadonly(this.#maintenancesSignal);
  #equipmentInformationSignal = shallowRef([]);
  equipmentInformation = shallowReadonly(this.#equipmentInformationSignal);
  #loadingSignal = shallowRef(false);
  loading = shallowReadonly(this.#loadingSignal);
  #savingSignal = shallowRef(false);
  saving = shallowReadonly(this.#savingSignal);
  #saveSucceededSignal = shallowRef(false);
  saveSucceeded = shallowReadonly(this.#saveSucceededSignal);
  #errorSignal = shallowRef(null);
  error = shallowReadonly(this.#errorSignal);
  loadForCompany(userId) {
    const version = ++this.#loadVersion;
    this.#loadingSignal.value = true;
    this.#errorSignal.value = null;
    forkJoin({
      equipmentInformation:
          this.#equipmentInformation.getEquipmentInformationByUserId(userId),
      maintenances: this.#maintenanceApi.getMaintenances(),
    })
        .pipe(
            map(({ equipmentInformation, maintenances }) => {
              const equipmentIds = new Set(
                  equipmentInformation.map((equipment) => equipment.id),
              );
              return {
                equipmentInformation,
                maintenances: maintenances
                    .filter((maintenance) =>
                        equipmentIds.has(maintenance.equipmentId),
                    )
                    .sort(
                        (firstMaintenance, secondMaintenance) =>
                            secondMaintenance.performedAt.getTime() -
                            firstMaintenance.performedAt.getTime(),
                    ),
              };
            }),
            takeUntil(sessionEnded),
        )
        .subscribe({
          next: ({ equipmentInformation, maintenances }) => {
            if (version !== this.#loadVersion) return;
            this.#equipmentInformationSignal.value = equipmentInformation;
            this.#maintenancesSignal.value = maintenances;
            this.#loadingSignal.value = false;
            this.#errorSignal.value = null;
          },
          error: (error) => {
            if (version !== this.#loadVersion) return;
            this.#equipmentInformationSignal.value = [];
            this.#maintenancesSignal.value = [];
            this.#loadingSignal.value = false;
            this.#errorSignal.value = this.#formatError(
                error,
                "Failed to load maintenance records",
            );
          },
        });
  }
  // US23 - Register completed maintenance
  registerMaintenance(userId, equipmentId, performedAt, type) {
    this.#saveSucceededSignal.value = false;
    this.#errorSignal.value = null;
    const equipment = this.#equipmentInformationSignal.value.find(
        (currentEquipment) =>
            currentEquipment.id === equipmentId &&
            currentEquipment.ownerUserId === userId,
    );
    if (!equipment) {
      this.#errorSignal.value =
          "The selected equipment does not exist for this company";
      return;
    }
    let maintenance;
    try {
      maintenance = new Maintenance({
        id: 0,
        equipmentId,
        performedAt,
        type,
        status: MaintenanceStatus.COMPLETED,
      });
    } catch (error) {
      this.#errorSignal.value = this.#formatError(
          error,
          "Invalid maintenance information",
      );
      return;
    }
    this.#savingSignal.value = true;
    this.#maintenanceApi
        .createMaintenance(maintenance)
        .pipe(takeUntil(sessionEnded))
        .subscribe({
          next: (createdMaintenance) => {
            this.#maintenancesSignal.value = ((maintenances) => [
              createdMaintenance,
              ...maintenances,
            ])(this.#maintenancesSignal.value);
            this.#savingSignal.value = false;
            this.#saveSucceededSignal.value = true;
            this.#errorSignal.value = null;
          },
          error: (error) => {
            this.#savingSignal.value = false;
            this.#saveSucceededSignal.value = false;
            this.#errorSignal.value = this.#formatError(
                error,
                "Failed to register maintenance",
            );
          },
        });
  }
  // US24 - Schedule pending maintenance
  scheduleMaintenance(userId, equipmentId, scheduledAt, type) {
    this.#saveSucceededSignal.value = false;
    this.#errorSignal.value = null;
    const equipment = this.#equipmentInformationSignal.value.find(
        (currentEquipment) =>
            currentEquipment.id === equipmentId &&
            currentEquipment.ownerUserId === userId,
    );
    if (!equipment) {
      this.#errorSignal.value =
          "The selected equipment does not exist for this company";
      return;
    }
    let maintenance;
    try {
      maintenance = Maintenance.schedule({
        id: 0,
        equipmentId,
        scheduledAt,
        type,
      });
    } catch (error) {
      this.#errorSignal.value = this.#formatError(
          error,
          "Invalid scheduled maintenance information",
      );
      return;
    }
    this.#savingSignal.value = true;
    this.#maintenanceApi
        .createMaintenance(maintenance)
        .pipe(takeUntil(sessionEnded))
        .subscribe({
          next: (createdMaintenance) => {
            this.#maintenancesSignal.value = ((maintenances) => [
              createdMaintenance,
              ...maintenances,
            ])(this.#maintenancesSignal.value);
            this.#savingSignal.value = false;
            this.#saveSucceededSignal.value = true;
            this.#errorSignal.value = null;
          },
          error: (error) => {
            this.#savingSignal.value = false;
            this.#saveSucceededSignal.value = false;
            this.#errorSignal.value = this.#formatError(
                error,
                "Failed to schedule maintenance",
            );
          },
        });
  }
  // Advance the existing aggregate through the established PATCH command (never POST).
  completeMaintenance(userId, record, technician, notes) {
    if (this.#savingSignal.value) return;
    this.#saveSucceededSignal.value = false;
    this.#errorSignal.value = null;
    const equipment = this.#equipmentInformationSignal.value.find(
        (current) =>
            current.id === record.equipmentId && current.ownerUserId === userId,
    );
    const current = this.#maintenancesSignal.value.find(
        (item) => item.id === record.id,
    );
    if (!equipment || !current || current.equipmentId !== record.equipmentId) {
      this.#errorSignal.value = "Maintenance does not belong to this company";
      return;
    }
    if (
        current.status !== MaintenanceStatus.SCHEDULED &&
        current.status !== MaintenanceStatus.IN_PROGRESS
    ) {
      this.#errorSignal.value = "Only pending maintenance can be completed";
      return;
    }
    if (!technician.trim()) {
      this.#errorSignal.value =
          "Technician is required to document the completed work";
      return;
    }
    this.#savingSignal.value = true;
    this.#maintenanceApi
        .advanceMaintenance(
            record.id,
            MaintenanceStatus.COMPLETED,
            technician.trim(),
            notes.trim(),
        )
        .pipe(takeUntil(sessionEnded))
        .subscribe({
          next: (updated) => {
            // Preserve the aggregate identity and replace, rather than append, its read model.
            this.#maintenancesSignal.value = ((items) =>
                items.map((item) => (item.id === updated.id ? updated : item)))(
                this.#maintenancesSignal.value,
            );
            this.#savingSignal.value = false;
            this.#saveSucceededSignal.value = true;
            this.#errorSignal.value = null;
          },
          error: (error) => {
            this.#savingSignal.value = false;
            this.#saveSucceededSignal.value = false;
            this.#errorSignal.value = this.#formatError(
                error,
                "Failed to complete maintenance",
            );
          },
        });
  }
  clearSaveState() {
    this.#saveSucceededSignal.value = false;
    this.#errorSignal.value = null;
  }
  clear() {
    ++this.#loadVersion;
    this.#maintenancesSignal.value = [];
    this.#equipmentInformationSignal.value = [];
    this.#loadingSignal.value = false;
    this.#savingSignal.value = false;
    this.#saveSucceededSignal.value = false;
    this.#errorSignal.value = null;
  }
  getEquipmentInformation(equipmentId) {
    return this.#equipmentInformationSignal.value.find(
        (equipment) => equipment.id === equipmentId,
    );
  }
  #formatError(error, fallbackMessage) {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return fallbackMessage;
  }
}

export const useMaintenanceStore = defineStore("maintenance", () =>
    exposeStore(new MaintenanceStore()),
);
registerStore(MaintenanceStore, useMaintenanceStore);
