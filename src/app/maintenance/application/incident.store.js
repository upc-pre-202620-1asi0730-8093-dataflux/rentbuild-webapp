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
import { Incident } from "../domain/model/incident.entity.js";
import { IncidentStatus } from "../domain/model/incident-status.enum.js";
import { IncidentReactivationPolicy } from "../domain/model/incident-reactivation-policy.js";
import { IncidentApi } from "../infrastructure/incident-api.js";
import { MAINTENANCE_EQUIPMENT_INFORMATION_PORT } from "../infrastructure/equipment-information.port.js";
export class IncidentStore {
  #incidentApi = resolve(IncidentApi);
  #equipmentInformation = resolve(MAINTENANCE_EQUIPMENT_INFORMATION_PORT);
  #loadVersion = 0;
  #incidentsSignal = shallowRef([]);
  incidents = shallowReadonly(this.#incidentsSignal);
  #equipmentInformationSignal = shallowRef([]);
  equipmentInformation = shallowReadonly(this.#equipmentInformationSignal);
  #loadingSignal = shallowRef(false);
  loading = shallowReadonly(this.#loadingSignal);
  #savingSignal = shallowRef(false);
  saving = shallowReadonly(this.#savingSignal);
  #saveSucceededSignal = shallowRef(false);
  saveSucceeded = shallowReadonly(this.#saveSucceededSignal);
  #resolvingIncidentIdSignal = shallowRef(null);
  resolvingIncidentId = shallowReadonly(this.#resolvingIncidentIdSignal);
  #resolveSucceededSignal = shallowRef(false);
  resolveSucceeded = shallowReadonly(this.#resolveSucceededSignal);
  #restrictingIncidentIdSignal = shallowRef(null);
  restrictingIncidentId = shallowReadonly(this.#restrictingIncidentIdSignal);
  #restrictionSucceededSignal = shallowRef(false);
  restrictionSucceeded = shallowReadonly(this.#restrictionSucceededSignal);
  #reactivatingEquipmentIdSignal = shallowRef(null);
  reactivatingEquipmentId = shallowReadonly(
      this.#reactivatingEquipmentIdSignal,
  );
  #reactivationSucceededSignal = shallowRef(false);
  reactivationSucceeded = shallowReadonly(this.#reactivationSucceededSignal);
  reactivatableEquipment = computed(() =>
      this.#equipmentInformationSignal.value.filter(
          (equipment) =>
              equipment.status === "MAINTENANCE" &&
              IncidentReactivationPolicy.canReactivate(
                  equipment.id,
                  this.#incidentsSignal.value,
              ),
      ),
  );
  // Candidates are displayed for a REQUEST, never treated as automatically eligible.
  // Spring Boot remains the authority for maintenance, incidents and Rentals ACL evidence.
  reactivationCandidates = computed(() =>
      this.#equipmentInformationSignal.value.filter(
          (equipment) =>
              equipment.status === "MAINTENANCE" &&
              !this.#incidentsSignal.value.some(
                  (incident) =>
                      incident.equipmentId === equipment.id &&
                      incident.blocksRental &&
                      incident.status === IncidentStatus.OPEN,
              ),
      ),
  );
  #errorSignal = shallowRef(null);
  error = shallowReadonly(this.#errorSignal);
  loadForCompany(userId) {
    const loadVersion = ++this.#loadVersion;
    this.#loadingSignal.value = true;
    this.#saveSucceededSignal.value = false;
    this.#resolveSucceededSignal.value = false;
    this.#restrictionSucceededSignal.value = false;
    this.#reactivationSucceededSignal.value = false;
    this.#errorSignal.value = null;
    forkJoin({
      equipmentInformation:
          this.#equipmentInformation.getEquipmentInformationByUserId(userId),
      incidents: this.#incidentApi.getIncidents(),
    })
        .pipe(
            map(({ equipmentInformation, incidents }) => {
              const companyEquipment = equipmentInformation.filter(
                  (equipment) => equipment.ownerUserId === userId,
              );
              const equipmentIds = new Set(
                  companyEquipment.map((equipment) => equipment.id),
              );
              return {
                equipmentInformation: companyEquipment,
                incidents: incidents
                    .filter((incident) => equipmentIds.has(incident.equipmentId))
                    .sort(
                        (first, second) =>
                            second.reportedAt.getTime() - first.reportedAt.getTime(),
                    ),
              };
            }),
            takeUntil(sessionEnded),
        )
        .subscribe({
          next: ({ equipmentInformation, incidents }) => {
            if (loadVersion !== this.#loadVersion) return;
            this.#equipmentInformationSignal.value = equipmentInformation;
            this.#incidentsSignal.value = incidents;
            this.#loadingSignal.value = false;
            this.#errorSignal.value = null;
          },
          error: (error) => {
            if (loadVersion !== this.#loadVersion) return;
            this.#equipmentInformationSignal.value = [];
            this.#incidentsSignal.value = [];
            this.#loadingSignal.value = false;
            this.#errorSignal.value = this.#formatError(
                error,
                "Failed to load incident records",
            );
          },
        });
  }
  registerIncident(userId, equipmentId, description, blocksRental = false) {
    if (
        this.#savingSignal.value ||
        this.#resolvingIncidentIdSignal.value !== null ||
        this.#restrictingIncidentIdSignal.value !== null
    ) {
      return;
    }
    this.#saveSucceededSignal.value = false;
    this.#resolveSucceededSignal.value = false;
    this.#restrictionSucceededSignal.value = false;
    this.#errorSignal.value = null;
    const equipment = this.#equipmentInformationSignal.value.find(
        (item) => item.id === equipmentId && item.ownerUserId === userId,
    );
    if (!equipment) {
      this.#errorSignal.value =
          "The selected equipment does not belong to this company";
      return;
    }
    let incident;
    try {
      incident = Incident.report({ equipmentId, description, blocksRental });
    } catch (error) {
      this.#errorSignal.value = this.#formatError(
          error,
          "Invalid incident information",
      );
      return;
    }
    // Spring Boot owns the incident creation and any required Inventory status change.
    // Do not PATCH Inventory separately from the browser.
    this.#savingSignal.value = true;
    this.#incidentApi
        .createIncident(incident)
        .pipe(takeUntil(sessionEnded))
        .subscribe({
          next: (createdIncident) => {
            this.#incidentsSignal.value = ((incidents) =>
                [createdIncident, ...incidents].sort(
                    (first, second) =>
                        second.reportedAt.getTime() - first.reportedAt.getTime(),
                ))(this.#incidentsSignal.value);
            if (blocksRental) this.#markEquipmentInMaintenance(equipmentId);
            this.#savingSignal.value = false;
            this.#saveSucceededSignal.value = true;
            this.#errorSignal.value = null;
          },
          error: (error) => {
            this.#savingSignal.value = false;
            this.#saveSucceededSignal.value = false;
            this.#errorSignal.value = this.#formatError(
                error,
                "Failed to register incident",
            );
          },
        });
  }
  resolveIncident(userId, incidentId) {
    if (
        this.#savingSignal.value ||
        this.#resolvingIncidentIdSignal.value !== null ||
        this.#restrictingIncidentIdSignal.value !== null
    ) {
      return;
    }
    this.#saveSucceededSignal.value = false;
    this.#resolveSucceededSignal.value = false;
    this.#restrictionSucceededSignal.value = false;
    this.#errorSignal.value = null;
    const originalIncident = this.#incidentsSignal.value.find(
        (incident) => incident.id === incidentId,
    );
    if (!originalIncident || originalIncident.status !== IncidentStatus.OPEN) {
      this.#errorSignal.value = "Incident is missing or already resolved";
      return;
    }
    const ownsEquipment = this.#equipmentInformationSignal.value.some(
        (equipment) =>
            equipment.id === originalIncident.equipmentId &&
            equipment.ownerUserId === userId,
    );
    if (!ownsEquipment) {
      this.#errorSignal.value = "Incident does not belong to this company";
      return;
    }
    let resolvedIncident;
    try {
      resolvedIncident = new Incident({
        id: originalIncident.id,
        equipmentId: originalIncident.equipmentId,
        description: originalIncident.description,
        reportedAt: originalIncident.reportedAt,
        blocksRental: originalIncident.blocksRental,
        status: originalIncident.status,
        resolvedAt: originalIncident.resolvedAt,
      });
      resolvedIncident.resolve();
    } catch (error) {
      this.#errorSignal.value = this.#formatError(
          error,
          "Could not resolve incident",
      );
      return;
    }
    this.#resolvingIncidentIdSignal.value = incidentId;
    this.#incidentApi
        .resolveIncident(resolvedIncident)
        .pipe(takeUntil(sessionEnded))
        .subscribe({
          next: (persistedIncident) => {
            this.#incidentsSignal.value = ((incidents) =>
                incidents.map((incident) =>
                    incident.id === persistedIncident.id
                        ? persistedIncident
                        : incident,
                ))(this.#incidentsSignal.value);
            this.#resolvingIncidentIdSignal.value = null;
            this.#resolveSucceededSignal.value = true;
            this.#errorSignal.value = null;
          },
          error: (error) => {
            this.#resolvingIncidentIdSignal.value = null;
            this.#resolveSucceededSignal.value = false;
            this.#errorSignal.value = this.#formatError(
                error,
                "Failed to resolve incident",
            );
          },
        });
  }
  requireRentalRestriction(userId, incidentId) {
    if (
        this.#loadingSignal.value ||
        this.#savingSignal.value ||
        this.#resolvingIncidentIdSignal.value !== null ||
        this.#restrictingIncidentIdSignal.value !== null
    ) {
      return;
    }
    this.#saveSucceededSignal.value = false;
    this.#resolveSucceededSignal.value = false;
    this.#restrictionSucceededSignal.value = false;
    this.#errorSignal.value = null;
    const current = this.#incidentsSignal.value.find(
        (incident) => incident.id === incidentId,
    );
    if (
        !current ||
        current.status !== IncidentStatus.OPEN ||
        current.blocksRental
    ) {
      this.#errorSignal.value =
          "Only open incidents without a rental restriction can be updated";
      return;
    }
    const belongsToCompany = this.#equipmentInformationSignal.value.some(
        (equipment) =>
            equipment.id === current.equipmentId &&
            equipment.ownerUserId === userId,
    );
    if (!belongsToCompany) {
      this.#errorSignal.value = "Incident does not belong to this company";
      return;
    }
    let updated;
    try {
      updated = new Incident({
        id: current.id,
        equipmentId: current.equipmentId,
        description: current.description,
        reportedAt: current.reportedAt,
        blocksRental: current.blocksRental,
        status: current.status,
        resolvedAt: current.resolvedAt,
      });
      updated.requireRentalRestriction();
    } catch (error) {
      this.#errorSignal.value = this.#formatError(
          error,
          "Cannot update this incident",
      );
      return;
    }
    // The backend updates the incident and its operational restriction atomically.
    this.#restrictingIncidentIdSignal.value = incidentId;
    this.#incidentApi
        .requireRentalRestriction(updated)
        .pipe(takeUntil(sessionEnded))
        .subscribe({
          next: (persisted) => {
            this.#incidentsSignal.value = ((incidents) =>
                incidents.map((incident) =>
                    incident.id === persisted.id ? persisted : incident,
                ))(this.#incidentsSignal.value);
            this.#markEquipmentInMaintenance(current.equipmentId);
            this.#restrictingIncidentIdSignal.value = null;
            this.#restrictionSucceededSignal.value = true;
            this.#errorSignal.value = null;
          },
          error: (error) => {
            this.#restrictingIncidentIdSignal.value = null;
            this.#restrictionSucceededSignal.value = false;
            this.#errorSignal.value = this.#formatError(
                error,
                "Failed to update rental restriction",
            );
          },
        });
  }
  // Explicit equipment reactivation after inspection and resolution of blocking incidents.
  reactivateEquipment(userId, equipmentId, inspectionConfirmed) {
    if (
        this.#loadingSignal.value ||
        this.#savingSignal.value ||
        this.#resolvingIncidentIdSignal.value !== null ||
        this.#restrictingIncidentIdSignal.value !== null ||
        this.#reactivatingEquipmentIdSignal.value !== null
    ) {
      return;
    }
    this.clearSaveState();
    const equipment = this.#equipmentInformationSignal.value.find(
        (item) => item.id === equipmentId && item.ownerUserId === userId,
    );
    if (!inspectionConfirmed) {
      this.#errorSignal.value =
          "Confirm the technical inspection before reactivating equipment";
      return;
    }
    if (!equipment || equipment.status !== "MAINTENANCE") {
      this.#errorSignal.value =
          "Only your equipment in MAINTENANCE can be reactivated";
      return;
    }
    if (
        this.#incidentsSignal.value.some(
            (incident) =>
                incident.equipmentId === equipmentId &&
                incident.blocksRental &&
                incident.status === IncidentStatus.OPEN,
        )
    ) {
      this.#errorSignal.value =
          "Unresolved blocking incidents prevent reactivation";
      return;
    }
    this.#reactivatingEquipmentIdSignal.value = equipmentId;
    // The server checks open incidents, active rentals, inspection confirmation,
    // and maintenance transitions before reactivating Inventory.
    this.#incidentApi
        .reactivateEquipment(equipmentId, inspectionConfirmed)
        .pipe(takeUntil(sessionEnded))
        .subscribe({
          next: () => {
            this.#equipmentInformationSignal.value = ((items) =>
                items.map((item) =>
                    item.id === equipmentId ? { ...item, status: "AVAILABLE" } : item,
                ))(this.#equipmentInformationSignal.value);
            this.#reactivatingEquipmentIdSignal.value = null;
            this.#reactivationSucceededSignal.value = true;
            this.#errorSignal.value = null;
          },
          error: (error) => {
            this.#reactivatingEquipmentIdSignal.value = null;
            this.#reactivationSucceededSignal.value = false;
            this.#errorSignal.value = this.#formatError(
                error,
                "Failed to reactivate equipment",
            );
          },
        });
  }
  getEquipmentInformation(equipmentId) {
    return this.#equipmentInformationSignal.value.find(
        (equipment) => equipment.id === equipmentId,
    );
  }
  clearSaveState() {
    this.#reactivationSucceededSignal.value = false;
    this.#saveSucceededSignal.value = false;
    this.#resolveSucceededSignal.value = false;
    this.#restrictionSucceededSignal.value = false;
    this.#errorSignal.value = null;
  }
  clear() {
    ++this.#loadVersion;
    this.#incidentsSignal.value = [];
    this.#equipmentInformationSignal.value = [];
    this.#loadingSignal.value = false;
    this.#savingSignal.value = false;
    this.#saveSucceededSignal.value = false;
    this.#resolvingIncidentIdSignal.value = null;
    this.#resolveSucceededSignal.value = false;
    this.#restrictingIncidentIdSignal.value = null;
    this.#restrictionSucceededSignal.value = false;
    this.#reactivatingEquipmentIdSignal.value = null;
    this.#reactivationSucceededSignal.value = false;
    this.#errorSignal.value = null;
  }
  #markEquipmentInMaintenance(equipmentId) {
    this.#equipmentInformationSignal.value = ((items) =>
        items.map((item) =>
            item.id === equipmentId ? { ...item, status: "MAINTENANCE" } : item,
        ))(this.#equipmentInformationSignal.value);
  }
  #formatError(error, fallbackMessage) {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return fallbackMessage;
  }
}

export const useIncidentStore = defineStore("incident", () =>
    exposeStore(new IncidentStore()),
);
registerStore(IncidentStore, useIncidentStore);
