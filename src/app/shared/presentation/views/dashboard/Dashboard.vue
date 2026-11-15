<script setup>
import { computed, onMounted, shallowRef, watch, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { useServices } from "../../../../app.services.js";
import Feedback from "../../components/feedback/Feedback.vue";
import { forkJoin, catchError, of, map } from "rxjs";
import { resolve } from "../../../infrastructure/services.js";
import { InventoryApi } from "../../../../inventory/infrastructure/inventory-api.js";
import { RentalsApi } from "../../../../rentals/infrastructure/rentals-api.js";
import { MaintenanceApi } from "../../../../maintenance/infrastructure/maintenance-api.js";
import { IncidentApi } from "../../../../maintenance/infrastructure/incident-api.js";
import { RentalLifecycleDatePolicy as Calendar } from "../../../../rentals/domain/policy/rental-lifecycle-date.policy.js";
const { t, locale } = useI18n();
const { iam, inventory, rentals, profiles, subscriptions } = useServices();
const overview = shallowRef(null),
  overviewLoading = shallowRef(false);
let request;
watch(
  () => [iam.currentUserId.value, iam.currentRole.value],
  ([id, role]) => {
    request?.unsubscribe();
    overview.value = null;
    if (!id) return;
    overviewLoading.value = true;
    const owner = role === "rental_company";
    const safe = (stream) => stream.pipe(catchError(() => of(null)));
    request = forkJoin({
      equipment: safe(
        owner
          ? resolve(InventoryApi).getEquipmentByUserId(id)
          : resolve(InventoryApi).getEquipment(),
      ),
      rentals: safe(
        resolve(RentalsApi)
          .getRentals()
          .pipe(
            map((items) =>
              items.filter((x) =>
                owner
                  ? x.rentalCompanyUserId === id
                  : x.constructionUserId === id,
              ),
            ),
          ),
      ),
      requests: safe(
        resolve(RentalsApi)
          .getRentalRequests()
          .pipe(
            map((items) =>
              items.filter((x) =>
                owner
                  ? x.rentalCompanyUserId === id
                  : x.constructionUserId === id,
              ),
            ),
          ),
      ),
      maintenance: owner
        ? safe(resolve(MaintenanceApi).getMaintenances())
        : of([]),
      incidents: owner ? safe(resolve(IncidentApi).getIncidents()) : of([]),
    }).subscribe((data) => {
      const owned = new Set(
        (data.equipment || []).filter((x) => x.userId === id).map((x) => x.id),
      );
      if (owner) {
        data.maintenance =
          data.equipment === null
            ? null
            : data.maintenance?.filter((x) => owned.has(x.equipmentId));
        data.incidents =
          data.equipment === null
            ? null
            : data.incidents?.filter((x) => owned.has(x.equipmentId));
      }
      overview.value = data;
      overviewLoading.value = false;
    });
  },
  { immediate: true },
);
onBeforeUnmount(() => request?.unsubscribe());
const upcoming = computed(
  () =>
    overview.value?.rentals
      ?.filter(
        (x) =>
          x.isConfirmed &&
          Calendar.limaDay(x.period.startDate) >= Calendar.limaDay(new Date()),
      )
      .sort((a, b) => a.period.startDate - b.period.startDate) || [],
);
const active = computed(
  () =>
    overview.value?.rentals
      ?.filter((x) => x.isActive)
      .sort((a, b) => a.period.endDate - b.period.endDate) || [],
);
const care = computed(() =>
  [
    ...(overview.value?.maintenance || [])
      .filter((x) => x.status !== "COMPLETED")
      .map((x) => ({
        id: "m" + x.id,
        equipmentId: x.equipmentId,
        text: x.type,
        at: x.performedAt,
      })),
    ...(overview.value?.incidents || [])
      .filter((x) => x.status === "OPEN")
      .map((x) => ({
        id: "i" + x.id,
        equipmentId: x.equipmentId,
        text: x.description,
        at: x.reportedAt,
      })),
  ].sort((a, b) => a.at - b.at),
);
const activities = computed(() =>
  [
    ...(overview.value?.requests || []).map((x) => ({
      id: "r" + x.id,
      equipmentId: x.equipmentId,
      text: "#" + x.id,
      at: x.createdAt,
    })),
    ...(overview.value?.incidents || []).map((x) => ({
      id: "i" + x.id,
      equipmentId: x.equipmentId,
      text: x.description,
      at: x.reportedAt,
    })),
    ...(overview.value?.maintenance || [])
      .filter((x) => x.status === "COMPLETED")
      .map((x) => ({
        id: "m" + x.id,
        equipmentId: x.equipmentId,
        text: x.type,
        at: x.performedAt,
      })),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 3),
);
function equipmentName(id) {
  return overview.value?.equipment?.find((x) => x.id === id)?.name || "#" + id;
}
function format(value) {
  return new Intl.DateTimeFormat(locale.value, {
    dateStyle: "medium",
    timeZone: "America/Lima",
  }).format(value);
}
function countStatus(status) {
  return (
    overview.value?.equipment?.filter((x) => x.status === status).length ?? "—"
  );
}

const rentalCompany = computed(
  () => iam.currentRole.value === "rental_company",
);
onMounted(() => {
  profiles.loadProfileByUserId(iam.currentUserId.value);
  if (rentalCompany.value) {
    subscriptions.loadCurrentSubscription(iam.currentUserId.value);
    inventory.loadEquipmentByUserId(iam.currentUserId.value);
    rentals.loadRentalRequestsForCompany(iam.currentUserId.value);
  } else {
    inventory.loadMarketplaceEquipment();
    rentals.loadRentalRequestsForConstructionCompany(iam.currentUserId.value);
  }
});
</script>
<template>
  <span class="eyebrow">{{
    t(
      rentalCompany
        ? "dashboard.rental-company"
        : "dashboard.construction-company",
    )
  }}</span>
  <h1>
    {{
      t(
        rentalCompany
          ? "dashboard.rental-title"
          : "dashboard.construction-title",
      )
    }}
  </h1>
  <p>
    {{ t("dashboard.welcome") }}
    {{ profiles.profile.value?.companyName || iam.currentEmail.value }}
  </p>
  <Feedback
    :loading="
      inventory.loading.value || rentals.loading.value || profiles.loading.value
    "
    :error="
      inventory.error.value ||
      rentals.error.value ||
      profiles.error.value ||
      subscriptions.subscriptionError.value
    "
  />
  <div class="stats">
    <article class="card">
      <span>{{ t("navigation.equipment") }}</span
      ><strong>{{ inventory.equipmentCount.value }}</strong>
    </article>
    <article class="card">
      <span>{{ t("rentals.requests.summary.pending") }}</span
      ><strong>{{ rentals.pendingRequestCount.value }}</strong>
    </article>
    <article class="card">
      <span>{{ t("rentals.requests.summary.approved") }}</span
      ><strong>{{ rentals.approvedRequestCount.value }}</strong>
    </article>
  </div>
  <section class="card">
    <h2>{{ t("navigation.dashboard") }}</h2>
    <div class="actions" v-if="rentalCompany">
      <RouterLink class="button" to="/subscriptions/plans">{{
        t("navigation.plan-subscription")
      }}</RouterLink
      ><RouterLink class="button secondary" to="/inventory/equipment">{{
        t("navigation.equipment")
      }}</RouterLink
      ><RouterLink class="button secondary" to="/rentals/requests">{{
        t("navigation.rental-requests")
      }}</RouterLink>
    </div>
    <div class="actions" v-else>
      <RouterLink class="button" to="/inventory/search">{{
        t("navigation.search-equipment")
      }}</RouterLink
      ><RouterLink class="button secondary" to="/rentals/my-requests">{{
        t("navigation.my-requests")
      }}</RouterLink>
    </div>
  </section>
  <p v-if="overviewLoading" role="status">{{ t("dashboard.loading-data") }}</p>
  <template v-if="overview">
    <div v-if="rentalCompany" class="stats">
      <article
        v-for="[status, key] in [
          ['AVAILABLE', 'available-equipment'],
          ['RENTED', 'equipment-on-rent'],
          ['MAINTENANCE', 'under-maintenance'],
        ]"
        :key="status"
        class="card"
      >
        <span>{{ t("dashboard." + key) }}</span
        ><strong>{{ countStatus(status) }}</strong>
      </article>
    </div>
    <div class="cards">
      <section class="card">
        <h2>{{ t("dashboard.upcoming-reservations") }}</h2>
        <p v-if="overview.rentals === null">
          {{ t("dashboard.unavailable-data") }}
        </p>
        <p v-else-if="!upcoming.length">{{ t("dashboard.no-upcoming") }}</p>
        <p v-for="item in upcoming.slice(0, 5)" :key="item.id">
          {{ equipmentName(item.equipmentId) }} ·
          {{ format(item.period.startDate) }}
        </p>
      </section>
      <section class="card">
        <h2>{{ t("dashboard.active-rentals") }}</h2>
        <p v-if="overview.rentals === null">
          {{ t("dashboard.unavailable-data") }}
        </p>
        <p v-else-if="!active.length">{{ t("dashboard.no-active") }}</p>
        <p v-for="item in active.slice(0, 5)" :key="item.id">
          {{ equipmentName(item.equipmentId) }} ·
          {{ format(item.period.endDate) }}
        </p>
      </section>
      <section v-if="rentalCompany" class="card">
        <h2>{{ t("dashboard.equipment-care") }}</h2>
        <p v-if="overview.maintenance === null || overview.incidents === null">
          {{ t("dashboard.unavailable-data") }}
        </p>
        <p v-else-if="!care.length">{{ t("dashboard.no-care") }}</p>
        <p v-for="item in care.slice(0, 5)" :key="item.id">
          {{ equipmentName(item.equipmentId) }} · {{ item.text }} ·
          {{ format(item.at) }}
        </p>
      </section>
      <section class="card">
        <h2>{{ t("dashboard.recent-activity") }}</h2>
        <p
          v-if="
            overview.requests === null ||
            overview.incidents === null ||
            overview.maintenance === null
          "
        >
          {{ t("dashboard.unavailable-data") }}
        </p>
        <p v-else-if="!activities.length">{{ t("dashboard.no-records") }}</p>
        <p v-for="item in activities" :key="item.id">
          {{ equipmentName(item.equipmentId) }} · {{ item.text }} ·
          {{ format(item.at) }}
        </p>
      </section>
    </div>
  </template>
</template>
