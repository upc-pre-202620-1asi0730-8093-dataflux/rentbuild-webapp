<script setup>
import { watch, onBeforeUnmount } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { useServices } from "../../../../app.services.js";
import { date } from "../../../../shared/presentation/format.js";
const { equipmentHistory: store } = useServices();
const route = useRoute();
const { t, te } = useI18n();
watch(
    () => route.params.equipmentId,
    (id) => store.load(Number(id)),
    { immediate: true },
);
onBeforeUnmount(() => store.clear());
function status(value) {
  const key = "maintenance.history.status." + value.toLowerCase();
  return te(key) ? t(key) : value;
}
</script>
<template>
  <RouterLink to="/inventory/equipment">{{
      t("maintenance.history.back")
    }}</RouterLink>
  <h1>{{ t("maintenance.history.title") }}</h1>
  <p>{{ t("maintenance.history.description") }}</p>
  <p v-if="store.loading.value" role="status">
    {{ t("maintenance.history.loading") }}
  </p>
  <p v-if="store.errorKey.value" class="notice error" role="alert">
    {{ t(store.errorKey.value) }}
  </p>
  <section v-if="store.history.value" class="card">
    <h2>
      {{ store.history.value.equipmentCode }} -
      {{ store.history.value.equipmentName }}
    </h2>
    <p>
      {{ store.history.value.entries.length }}
      {{ t("maintenance.history.records") }}
    </p>
    <div class="table-wrap">
      <table>
        <thead>
        <tr>
          <th>{{ t("maintenance.list.date") }}</th>
          <th>{{ t("maintenance.list.type") }}</th>
          <th>{{ t("maintenance.incidents.list.description") }}</th>
          <th>{{ t("maintenance.history.status-label") }}</th>
        </tr>
        </thead>
        <tbody>
        <tr
            v-for="entry in store.history.value.entries"
            :key="entry.kind + '-' + entry.id"
        >
          <td>{{ date(entry.occurredAt) }}</td>
          <td>
            {{ t("maintenance.history.kind." + entry.kind.toLowerCase()) }}
          </td>
          <td>{{ entry.description }}</td>
          <td>{{ status(entry.status) }}</td>
        </tr>
        </tbody>
      </table>
    </div>
    <p v-if="!store.history.value.entries.length">
      {{ t("maintenance.history.empty") }}
    </p>
  </section>
</template>
