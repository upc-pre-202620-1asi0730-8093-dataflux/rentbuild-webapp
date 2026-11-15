<script setup>
import { reactive, ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { RentalLifecycleDatePolicy as DatePolicy } from "../../../domain/policy/rental-lifecycle-date.policy.js";
const props = defineProps({
  operation: { type: String, required: true },
  busy: Boolean,
  rental: { type: Object, required: true },
});
const emit = defineEmits(["submit", "cancel"]);
const { t, locale } = useI18n();
const error = ref(null);
const min = computed(() => DatePolicy.limaDay(props.rental.period.startDate));
const max = computed(() =>
    props.operation === "delivery"
        ? [
          DatePolicy.limaDay(props.rental.period.endDate),
          DatePolicy.limaDay(new Date()),
        ].sort()[0]
        : DatePolicy.limaDay(new Date()),
);
const form = reactive({
  date: DatePolicy.limaDay(new Date()),
  notes: "",
  maintenanceRequired: false,
});
function submit() {
  if (props.busy) return;
  const issue =
      props.operation === "delivery"
          ? DatePolicy.deliveryDayIssue(form.date, props.rental)
          : DatePolicy.returnDayIssue(form.date, props.rental);
  error.value = issue
      ? DatePolicy.describe(
          issue,
          locale.value,
          min.value,
          DatePolicy.limaDay(props.rental.period.endDate),
      )
      : null;
  if (issue) return;
  emit("submit", {
    date: DatePolicy.selectedDayToInstant(form.date),
    notes: form.notes,
    maintenanceRequired: form.maintenanceRequired,
  });
}
</script>
<template>
  <form class="card confirmation" @submit.prevent="submit">
    <h2>{{ t("rentals.active." + props.operation + ".title") }}</h2>
    <p>{{ t("rentals.active." + props.operation + ".subtitle") }}</p>
    <label
    >{{ t("rentals.active." + props.operation + ".date")
      }}<input
          v-model="form.date"
          type="date"
          :min="min"
          :max="max"
          required /></label
    ><label
  >{{ t("rentals.active.notes") }}<textarea v-model="form.notes" /></label
  ><label v-if="operation === 'return'" class="check"
  ><input v-model="form.maintenanceRequired" type="checkbox" />{{
      t("rentals.active.return.maintenance-required")
    }}</label
  >
    <p v-if="error" role="alert" class="notice error">{{ error }}</p>
    <div class="actions">
      <button :disabled="busy">
        {{ t("rentals.active." + props.operation + ".confirm") }}</button
      ><button
        type="button"
        class="secondary"
        :disabled="busy"
        @click="emit('cancel')"
    >
      {{ t("common.cancel") }}
    </button>
    </div>
  </form>
</template>
