<script setup>
import { ref, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { resolve } from "../../../../shared/infrastructure/services.js";
import { PasswordRecoveryService } from "../../../application/password-recovery.service.js";
import { PasswordRecoveryCommand } from "../../../domain/model/password-recovery.command.js";
import LanguageSwitcher from "../../../../shared/presentation/components/language-switcher/LanguageSwitcher.vue";
const { t } = useI18n();
const email = ref(""),
    sending = ref(false),
    message = ref(null),
    success = ref(false);
let subscription;
onBeforeUnmount(() => subscription?.unsubscribe());
function submit() {
  if (sending.value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()))
    return;
  sending.value = true;
  message.value = null;
  success.value = false;
  subscription = resolve(PasswordRecoveryService)
      .requestRecovery(new PasswordRecoveryCommand(email.value.trim()))
      .subscribe({
        next: () => {
          sending.value = false;
          success.value = true;
          message.value = "iam.recovery.success";
        },
        error: (error) => {
          sending.value = false;
          message.value = [404, 501].includes(error.status)
              ? "iam.recovery.unavailable"
              : "iam.recovery.error";
        },
      });
}
</script>
<template>
  <main id="main-content" class="auth-page" tabindex="-1">
    <section class="brand-panel">
      <img src="/rentbuild-logo.png" alt="RentBuild" class="logo" />
      <h1>RentBuild</h1>
      <p>{{ t("iam.auth.hero-description") }}</p>
    </section>
    <section class="auth-panel">
      <LanguageSwitcher />
      <section class="auth-card">
        <h2>{{ t("iam.recovery.title") }}</h2>
        <p>{{ t("iam.recovery.subtitle") }}</p>
        <p
            v-if="message"
            role="status"
            class="notice"
            :class="success ? 'success' : 'error'"
        >
          {{ t(message) }}
        </p>
        <form @submit.prevent="submit" :aria-busy="sending">
          <fieldset :disabled="sending">
            <label for="recovery-email"
            >{{ t("iam.sign-in.email")
              }}<input
                  id="recovery-email"
                  v-model="email"
                  type="email"
                  required
                  autocomplete="email"
              /></label>
            <button :disabled="sending">
              {{ t(sending ? "iam.recovery.sending" : "iam.recovery.submit") }}
            </button>
          </fieldset>
        </form>
        <p>
          <RouterLink to="/iam/sign-in">{{
              t("iam.recovery.back-to-sign-in")
            }}</RouterLink>
        </p>
      </section>
    </section>
  </main>
</template>
