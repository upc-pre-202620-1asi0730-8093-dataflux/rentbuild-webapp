<script setup>
import { computed, ref, reactive, watch, onBeforeUnmount } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { useServices } from "../../../../app.services.js";
import { RentalRequestReschedulingPolicy as PeriodPolicy } from "../../../domain/policy/rental-request-rescheduling.policy.js";
import { RentalLifecycleDatePolicy as DatePolicy } from "../../../domain/policy/rental-lifecycle-date.policy.js";
import { rentalRequestReschedulingCopy } from "./rental-request-rescheduling.copy.js";
const date = (value) => DatePolicy.limaDay(value);
import Feedback from "../../../../shared/presentation/components/feedback/Feedback.vue";
const { iam, rentals: store } = useServices();
const { t, locale } = useI18n();
const route = useRoute();
const editing = ref(false),
    issue = ref(null),
    form = reactive({ start: "", end: "" });
const copy = computed(() => rentalRequestReschedulingCopy(locale.value));
watch(
    () => [route.params.id, iam.currentUserId.value],
    ([value, userId]) => {
      store.clearRentalRequestDetail();
      editing.value = false;
      issue.value = null;
      const id = Number(value);
      if (Number.isInteger(id) && id > 0 && userId)
        store.loadRentalRequestDetail(id, userId);
    },
    { immediate: true },
);
onBeforeUnmount(() => store.clearRentalRequestDetail());
watch(
    () => store.reschedulingSucceeded.value,
    (success) => {
      if (success) editing.value = false;
    },
);
function editDates() {
  const r = store.selectedRentalRequest.value;
  store.clearReschedulingFeedback();
  form.start = date(r.period.startDate);
  form.end = date(r.period.endDate);
  issue.value = null;
  editing.value = true;
}
function save() {
  if (store.reschedulingRequestId.value !== null) return;
  issue.value = PeriodPolicy.issue(form.start, form.end);
  const r = store.selectedRentalRequest.value;
  if (
      !issue.value &&
      form.start === date(r.period.startDate) &&
      form.end === date(r.period.endDate)
  )
    issue.value = "UNCHANGED";
  if (issue.value) return;
  store.reschedulePendingRentalRequest(
      r.id,
      iam.currentUserId.value,
      PeriodPolicy.toPeriod(form.start, form.end),
  );
}
</script>
<template>
  <RouterLink to="/rentals/my-requests"
  >← {{ t("rentals.my-requests.detail.back") }}</RouterLink
  >
  <h1>{{ t("rentals.my-requests.detail.title") }} #{{ route.params.id }}</h1>
  <Feedback :loading="store.loading.value" :error="store.error.value" />
  <section v-if="store.selectedRentalRequest.value" class="card">
    <h2>
      {{
        store.getEquipmentInformation(
            store.selectedRentalRequest.value.equipmentId,
        )?.name
      }}
    </h2>
    <span
        class="badge"
        :class="store.selectedRentalRequest.value.status.toLowerCase()"
    >{{
        t(
            "rentals.my-requests.status." +
            store.selectedRentalRequest.value.status.toLowerCase(),
        )
      }}</span
    >
    <p
        v-if="store.reschedulingSucceeded.value"
        role="status"
        class="notice success"
    >
      {{ copy.success }}
    </p>
    <p v-if="store.reschedulingError.value" role="alert" class="notice error">
      {{ copy.errors[store.reschedulingError.value] }}
    </p>
    <button
        v-if="store.selectedRentalRequest.value.isPending && !editing"
        @click="editDates"
    >
      {{ copy.edit }}
    </button>
    <form v-if="editing" @submit.prevent="save" class="card">
      <h3>{{ copy.title }}</h3>
      <p>{{ copy.hint }}</p>
      <fieldset :disabled="store.reschedulingRequestId.value !== null">
        <label
        >{{ copy.start
          }}<input
              v-model="form.start"
              type="date"
              :min="DatePolicy.limaDay(new Date())"
              required
          /></label>
        <label
        >{{ copy.end
          }}<input v-model="form.end" type="date" :min="form.start" required
          /></label>
        <p v-if="issue" role="alert">
          {{ issue === "UNCHANGED" ? copy.unchanged : copy.dateIssues[issue] }}
        </p>
        <div class="actions">
          <button>
            {{
              store.reschedulingRequestId.value !== null
                  ? copy.saving
                  : copy.save
            }}</button
          ><button type="button" class="secondary" @click="editing = false">
          {{ copy.cancel }}
        </button>
        </div>
      </fieldset>
    </form>
    <dl>
      <dt>{{ t("rentals.my-requests.period") }}</dt>
      <dd>
        {{ date(store.selectedRentalRequest.value.period.startDate) }} —
        {{ date(store.selectedRentalRequest.value.period.endDate) }}
      </dd>
      <dt>{{ t("rentals.my-requests.requested-at") }}</dt>
      <dd>{{ date(store.selectedRentalRequest.value.createdAt) }}</dd>
    </dl>
  </section>
  <p v-else-if="!store.loading.value">
    {{ t("rentals.my-requests.detail.not-found-description") }}
  </p>
</template>
