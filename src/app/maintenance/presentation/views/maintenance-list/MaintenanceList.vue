<script setup>
import { computed, ref, shallowRef, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useServices } from "../../../../app.services.js";
import { date } from "../../../../shared/presentation/format.js";
import Feedback from "../../../../shared/presentation/components/feedback/Feedback.vue";
import MaintenanceForm from "../../components/maintenance-form/MaintenanceForm.vue";
const { iam, maintenance: store } = useServices();
const { t } = useI18n();
const mode = ref(null);
const query = ref(""),
    from = ref(""),
    to = ref(""),
    completion = shallowRef(null),
    technician = ref(""),
    notes = ref(""),
    acknowledged = ref(false);
const { locale } = useI18n();
const normalize = (v) =>
    v
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
const day = (value) =>
    new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Lima" }).format(value);
const invalidRange = computed(
    () => from.value && to.value && from.value > to.value,
);
function matches(item) {
  if (invalidRange.value) return false;
  const e = store.getEquipmentInformation(item.equipmentId);
  const key = day(item.performedAt);
  return (
      normalize((e?.name || "") + " " + (e?.code || "")).includes(
          normalize(query.value),
      ) &&
      (!from.value || key >= from.value) &&
      (!to.value || key <= to.value)
  );
}
function canComplete(item) {
  return (
      item.status === "IN_PROGRESS" ||
      (item.status === "SCHEDULED" && day(new Date()) >= day(item.performedAt))
  );
}
function openCompletion(item) {
  completion.value = item;
  technician.value = "";
  notes.value = "";
  acknowledged.value = false;
  store.clearSaveState();
}
function complete() {
  if (!acknowledged.value || !technician.value.trim() || store.saving.value)
    return;
  store.completeMaintenance(
      iam.currentUserId.value,
      completion.value,
      technician.value,
      notes.value,
  );
}
const filter = ref("");
const records = computed(() =>
    store.maintenances.value.filter(
        (item) => (!filter.value || item.status === filter.value) && matches(item),
    ),
);
onMounted(() => {
  store.clearSaveState();
  store.loadForCompany(iam.currentUserId.value);
});
watch(
    () => store.saveSucceeded.value,
    (success) => {
      if (success) {
        mode.value = null;
        completion.value = null;
      }
    },
);
function open(value) {
  store.clearSaveState();
  mode.value = value;
}
function submit(value) {
  if (store.saving.value) return;
  if (mode.value === "schedule")
    store.scheduleMaintenance(
        iam.currentUserId.value,
        value.equipmentId,
        value.date,
        value.type,
    );
  else
    store.registerMaintenance(
        iam.currentUserId.value,
        value.equipmentId,
        value.date,
        value.type,
    );
}
</script>
<template>
  <div class="page-heading">
    <h1>{{ t("maintenance.list.title") }}</h1>
    <RouterLink to="/maintenance/incidents">{{
        t("maintenance.incidents.list.title")
      }}</RouterLink>
  </div>
  <p>{{ t("maintenance.schedule.list.subtitle") }}</p>
  <div class="stats">
    <article class="card">
      <span>{{ t("maintenance.list.total") }}</span
      ><strong>{{ store.maintenances.value.length }}</strong>
    </article>
    <article class="card">
      <span>{{ t("maintenance.schedule.list.pending") }}</span
      ><strong>{{
        store.maintenances.value.filter((item) => item.status === "SCHEDULED")
            .length
      }}</strong>
    </article>
    <article class="card">
      <span>{{ t("maintenance.list.completed") }}</span
      ><strong>{{
        store.maintenances.value.filter((item) => item.status === "COMPLETED")
            .length
      }}</strong>
    </article>
  </div>
  <Feedback
      :loading="store.loading.value"
      :error="store.error.value"
      :success="store.saveSucceeded.value"
  />
  <div class="actions">
    <pv-button
        type="button"
        :disabled="!store.equipmentInformation.value.length || store.saving.value"
        @click="open('register')"
    >
      {{ t("maintenance.list.register") }}</pv-button
    ><pv-button
      type="button"
      class="secondary"
      :disabled="!store.equipmentInformation.value.length || store.saving.value"
      @click="open('schedule')"
  >
    {{ t("maintenance.schedule.list.button") }}
  </pv-button>
  </div>
  <p v-if="!store.equipmentInformation.value.length && !store.loading.value">
    {{ t("maintenance.list.no-equipment") }}
    <RouterLink to="/inventory/equipment/new">{{
        t("equipment.new")
      }}</RouterLink>
  </p>
  <MaintenanceForm
      v-if="mode"
      :key="mode"
      :scheduled="mode === 'schedule'"
      :equipment="store.equipmentInformation.value"
      :busy="store.saving.value"
      @submit="submit"
      @cancel="mode = null"
  />
  <form v-if="completion" class="card confirmation" @submit.prevent="complete">
    <h2>{{ t("maintenance.advance.dialog-title") }}</h2>
    <p>{{ t("maintenance.advance.dialog-description") }}</p>
    <fieldset :disabled="store.saving.value">
      <label
      >{{ t("maintenance.advance.technician")
        }}<input v-model="technician" required
        /></label>
      <label
      >{{ t("maintenance.advance.notes") }}<textarea v-model="notes" />
      </label>
      <label class="check"
      ><input v-model="acknowledged" type="checkbox" required />{{
          t("maintenance.advance.confirm-performed")
        }}</label
      >
      <div class="actions">
        <button :disabled="!acknowledged">
          {{ t("maintenance.advance.submit") }}</button
        ><button type="button" class="secondary" @click="completion = null">
        {{ t("common.cancel") }}
      </button>
      </div>
    </fieldset>
  </form>
  <div class="filters">
    <label
    >{{ t("maintenance.history-filters.equipment")
      }}<input
          v-model="query"
          type="search"
          :placeholder="t('maintenance.history-filters.placeholder')"
      /></label>
    <label
    >{{ t("maintenance.history-filters.from")
      }}<input v-model="from" type="date"
      /></label>
    <label
    >{{ t("maintenance.history-filters.to") }}<input v-model="to" type="date"
    /></label>
    <button
        type="button"
        class="secondary"
        @click="
        query = '';
        from = '';
        to = '';
      "
    >
      {{ t("maintenance.history-filters.clear") }}
    </button>
    <p v-if="invalidRange" role="alert">
      {{ t("maintenance.history-filters.invalid-range") }}
    </p>
    <label
    >{{ t("maintenance.schedule.list.filter-label")
      }}<select
          :aria-label="t('maintenance.schedule.list.filter-label')"
          v-model="filter"
      >
        <option value="">{{ t("common.all") }}</option>
        <option value="SCHEDULED">
          {{ t("maintenance.status.scheduled") }}
        </option>
        <option value="IN_PROGRESS">
          {{ t("maintenance.status.in_progress") }}
        </option>
        <option value="COMPLETED">
          {{ t("maintenance.status.completed") }}
        </option>
      </select></label
    >
  </div>
  <div class="card table-wrap">
    <table>
      <thead>
      <tr>
        <th>{{ t("maintenance.list.equipment") }}</th>
        <th>{{ t("maintenance.list.date") }}</th>
        <th>{{ t("maintenance.list.type") }}</th>
        <th>{{ t("maintenance.list.status") }}</th>
        <th>{{ t("maintenance.advance.actions") }}</th>
      </tr>
      </thead>
      <tbody>
      <tr v-for="item in records" :key="item.id">
        <td>
          {{
            store.getEquipmentInformation(item.equipmentId)?.name ||
            "#" + item.equipmentId
          }}
        </td>
        <td>{{ date(item.performedAt) }}</td>
        <td>{{ item.type }}</td>
        <td>
            <span class="badge">{{
                t("maintenance.status." + item.status.toLowerCase())
              }}</span>
        </td>
        <td>
          <RouterLink
              :to="'/maintenance/equipment/' + item.equipmentId + '/history'"
          >{{ t("maintenance.history.view") }}</RouterLink
          >
          <button
              v-if="['SCHEDULED', 'IN_PROGRESS'].includes(item.status)"
              :disabled="!canComplete(item) || store.saving.value"
              :title="
                !canComplete(item) ? t('maintenance.advance.not-due') : ''
              "
              @click="openCompletion(item)"
          >
            {{ t("maintenance.advance.complete-button") }}
          </button>
        </td>
      </tr>
      </tbody>
    </table>
    <p v-if="!records.length && !store.loading.value" class="empty">
      {{ t("common.empty") }}
    </p>
  </div>
</template>
