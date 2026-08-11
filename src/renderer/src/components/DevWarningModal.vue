<script setup lang="ts">
import { markRaw } from 'vue'
import { AlertTriangle } from '@lucide/vue'
import ModalDialog from './ModalDialog.vue'

defineProps<{
  isOpen: boolean
  translations?: Record<string, string>
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const alertIcon = markRaw(AlertTriangle)
</script>

<template>
  <ModalDialog
    :is-open="isOpen"
    :title="translations?.dev_warning_title || 'Non-Official Build Warning'"
    :icon="alertIcon"
    icon-color="#ef4444"
    max-width="360px"
    @close="emit('close')"
  >
    <p class="warning-text">
      {{ translations?.dev_warning_text || 'You are running a development preview / non-official build of this application.' }}
    </p>
    <ul class="risk-list">
      <li>{{ translations?.dev_warning_risk_1 || 'Risk of unverified code execution or arbitrary code injection.' }}</li>
      <li>{{ translations?.dev_warning_risk_2 || 'Unstable features, debug logs, and potential data exposure.' }}</li>
      <li>{{ translations?.dev_warning_risk_3 || 'Lack of official cryptographic signature and release verification.' }}</li>
    </ul>
    <p class="warning-note">
      {{ translations?.dev_warning_note || 'Please use official releases for production environments.' }}
    </p>

    <template #footer>
      <button class="ok-btn" @click="emit('close')">{{ translations?.ok || 'OK' }}</button>
    </template>
  </ModalDialog>
</template>

<style scoped>
.warning-text {
  margin-bottom: 12px;
}

.risk-list {
  margin: 0 0 12px 18px;
  padding: 0;
  list-style-type: disc;
  color: var(--ev-c-text-2);
}

.risk-list li {
  margin-bottom: 6px;
}

.warning-note {
  font-size: 12px;
  color: var(--ev-c-text-3);
  font-style: italic;
  margin: 0;
}

.ok-btn {
  padding: 6px 20px;
  border-radius: 6px;
  border: none;
  background-color: var(--color-background-mute);
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  outline: none;
  transition: all 0.15s ease;
}

.ok-btn:hover {
  background-color: rgba(255, 255, 255, 0.15);
}

[data-theme='light'] .ok-btn:hover {
  background-color: rgba(0, 0, 0, 0.1);
}
</style>
