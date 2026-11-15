<script setup>
import {
  reactive,
  ref,
  shallowRef,
  computed,
  watch,
  onMounted,
  onUnmounted,
} from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { useServices } from "../../../../app.services.js";
import { resolve } from "../../../../shared/infrastructure/services.js";
import { EQUIPMENT_RENTAL_REQUEST_PORT } from "../../../infrastructure/equipment-rental-request.port.js";
import { DateRange } from "../../../../shared/domain/value-object/date-range.value-object.js";
import { localDate, money } from "../../../../shared/presentation/format.js";
import Feedback from "../../../../shared/presentation/components/feedback/Feedback.vue";
import AvailabilityBadge from "../../components/availability-badge/AvailabilityBadge.vue";
const RENTAL_REQUEST_ERROR_KEYS = {
  "Equipment is not available: its operational status has changed":
      "equipment.detail.request-errors.status-changed",
  "Equipment has an open blocking maintenance incident":
      "equipment.detail.request-errors.blocking-incident",
  "Equipment is already reserved for the selected period":
      "equipment.detail.request-errors.reserved",
  "Equipment already has a confirmed or active rental for the selected period":
      "equipment.detail.request-errors.rental-overlap",
  "Equipment does not belong to the requested rental company":
      "equipment.detail.request-errors.company-mismatch",
  "Equipment not found": "equipment.detail.request-errors.not-found",
  "Only construction companies can request equipment rental":
      "equipment.detail.request-errors.requester-role",
  "Unable to verify equipment reservations":
      "equipment.detail.request-errors.reservations-check-failed",
  "Unable to verify maintenance incidents":
      "equipment.detail.request-errors.incidents-check-failed",
  "Invalid equipment, company or rental period":
      "equipment.detail.request-errors.invalid-request",
  "Invalid equipment identifier":
      "equipment.detail.request-errors.invalid-request",
  "Equipment is unavailable for this period":
      "equipment.detail.request-errors.not-available",
  "You already have a pending or approved request for this equipment and an overlapping period":
      "equipment.detail.request-errors.duplicate-request",
  "Rental start date cannot be in the past":
      "equipment.detail.request-errors.past-date",
  "A construction company cannot rent equipment from itself":
      "equipment.detail.request-errors.same-company",
  "Rental company needs an active subscription":
      "equipment.detail.request-errors.subscription-inactive",
  "Equipment does not belong to the designated rental company":
      "equipment.detail.request-errors.company-mismatch",
  RENTALS_UNKNOWN_CONFLICT: "equipment.detail.request-errors.conflict",
  RENTALS_UNKNOWN_VALIDATION: "equipment.detail.request-errors.invalid-request",
  RENTALS_UNAUTHORIZED: "equipment.detail.request-errors.unauthorized",
  RENTALS_FORBIDDEN: "equipment.detail.request-errors.requester-role",
  RENTALS_NOT_FOUND: "equipment.detail.request-errors.not-found",
  RENTALS_NETWORK_ERROR: "equipment.detail.request-errors.network",
  RENTALS_SERVER_ERROR: "equipment.detail.request-errors.server-error",
};

const requestError = computed(() => {
  const message = requests.error.value;
  if (!message) return null;
  const key = RENTAL_REQUEST_ERROR_KEYS[message];
  return t(key || "equipment.detail.request-errors.generic");
});
const { iam, inventory: store } = useServices();
const requests = resolve(EQUIPMENT_RENTAL_REQUEST_PORT);
const route = useRoute();
const { t } = useI18n();
const id = Number(route.params.id);
const equipment = store.getEquipmentById(id);
const form = reactive({ startDate: "", endDate: "" });
const available = ref(null);
const checking = ref(false);
const error = ref(null);
const period = shallowRef(null);
let version = 0;
let subscription;
const construction = computed(
    () => iam.currentRole.value === "construction_company",
);
function invalidate() {
  ++version;
  subscription?.unsubscribe();
  checking.value = false;
  available.value = null;
  period.value = null;
  error.value = null;
}
watch(
    () => [form.startDate, form.endDate],
    () => {
      invalidate();
      requests.clearCreationState();
    },
);
watch(
    () => requests.error.value,
    (value) => {
      if (value) {
        invalidate();
        store.loadEquipmentById(id);
      }
    },
);
function check() {
  invalidate();
  requests.clearCreationState();
  let selected;
  try {
    selected = new DateRange({
      startDate: localDate(form.startDate),
      endDate: localDate(form.endDate, true),
    });
  } catch {
    error.value = t("equipment.detail.invalid-period");
    return;
  }
  const current = version;
  checking.value = true;
  subscription = store.verifyEquipmentAvailability(id, selected).subscribe({
    next: (result) => {
      if (current !== version) return;
      checking.value = false;
      available.value = result;
      period.value = result ? selected : null;
    },
    error: () => {
      if (current !== version) return;
      checking.value = false;
      error.value = t("equipment.detail.availability-check-failed");
    },
  });
}
function request() {
  if (
      !construction.value ||
      !available.value ||
      !period.value ||
      !equipment.value ||
      requests.loading.value
  )
    return;
  requests.submitRentalRequest(
      id,
      iam.currentUserId.value,
      equipment.value.userId,
      period.value,
  );
  available.value = null;
  period.value = null;
}
function focus() {
  invalidate();
  if (form.startDate && form.endDate) check();
  else store.loadEquipmentById(id);
}
onMounted(() => {
  requests.clearCreationState();
  store.loadEquipmentById(id);
  window.addEventListener("focus", focus);
});
onUnmounted(() => {
  invalidate();
  window.removeEventListener("focus", focus);
  requests.clearCreationState();
});
</script>
<template>
  <RouterLink :to="construction ? '/inventory/search' : '/inventory/equipment'"
  >← {{ t("equipment.detail.back") }}</RouterLink
  ><Feedback
    :loading="store.loading.value || checking || requests.loading.value"
    :error="error || store.error.value || requestError"
    :success="
      requests.latestCreatedRequest.value
        ? t('equipment.detail.request-created')
        : false
    "
/>
  <p v-if="requests.subscriptionRequired.value" class="notice error">
    {{ t("subscriptions.plans.no-current-plan") }}
  </p>
  <template v-if="equipment"
  ><div class="page-heading">
    <h1>{{ equipment.name }}</h1>
    <AvailabilityBadge :equipment="equipment" />
  </div>
    <section class="card">
      <h2>{{ t("equipment.detail.information") }}</h2>
      <p>{{ equipment.description }}</p>
      <dl>
        <dt>{{ t("equipment.code") }}</dt>
        <dd>{{ equipment.code }}</dd>
        <dt>{{ t("equipment.category") }}</dt>
        <dd>{{ equipment.category?.name }}</dd>
        <dt>{{ t("equipment.location") }}</dt>
        <dd>{{ equipment.location }}</dd>
        <dt>{{ t("equipment.daily-rate") }}</dt>
        <dd>
          {{
            money(equipment.rentalRate.dailyRate, equipment.rentalRate.currency)
          }}
        </dd>
        <dt>{{ t("equipment.weekly-rate") }}</dt>
        <dd>
          {{
            money(
                equipment.rentalRate.weeklyRate,
                equipment.rentalRate.currency,
            )
          }}
        </dd>
      </dl>
    </section>
    <section class="card">
      <RouterLink
          v-if="!construction"
          :to="'/maintenance/equipment/' + equipment.id + '/history'"
      >{{ t("maintenance.history.view") }}</RouterLink
      >
      <h2>{{ t("equipment.detail.period-availability") }}</h2>
      <p>{{ t("equipment.detail.period-description") }}</p>
      <form @submit.prevent="check">
        <div class="form-grid">
          <label
          >{{ t("equipment.detail.start-date")
            }}<input v-model="form.startDate" type="date" required /></label
          ><label
        >{{ t("equipment.detail.end-date")
          }}<input
              v-model="form.endDate"
              type="date"
              :min="form.startDate"
              required
          /></label>
        </div>
        <pv-button type="submit" :disabled="checking || requests.loading.value">
          {{ t("equipment.detail.check-availability") }}
        </pv-button>
      </form>
      <p
          v-if="available !== null"
          class="notice"
          :class="available ? 'success' : 'error'"
      >
        {{
          t(
              available
                  ? "equipment.detail.available-for-period"
                  : "equipment.detail.not-available-for-period",
          )
        }}
      </p>
      <pv-button
          type="button"
          v-if="construction"
          :disabled="!available || checking || requests.loading.value"
          @click="request"
      >
        {{ t("equipment.detail.request-rental") }}
      </pv-button>
    </section></template
  >
  <p v-else-if="!store.loading.value">{{ t("equipment.detail.not-found") }}</p>
</template>
