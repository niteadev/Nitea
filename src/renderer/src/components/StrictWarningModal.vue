<script setup lang="ts">
import { markRaw } from 'vue'
import { AlertOctagon } from '@lucide/vue'
import ModalDialog from './ModalDialog.vue'

defineProps<{
  isOpen: boolean
  translations?: Record<string, string>
}>()

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const alertIcon = markRaw(AlertOctagon)
</script>

<template>
  <ModalDialog
    :is-open="isOpen"
    :title="translations?.strict_mode_warning_title || 'Strict mode has no mercy'"
    :icon="alertIcon"
    icon-color="#ef4444"
    max-width="420px"
    @close="emit('cancel')"
  >
    <div class="warning-dialog-body">
      <p class="warning-dialog-main">
        {{ translations?.strict_mode_warning_text || 'Once enabled, you will not be able to exit the fullscreen window until the countdown finishes. The only way to exit prematurely is to forcefully restart your PC. Alt+F4, Task Manager, and system shortcuts are completely disabled.' }}
      </p>
    </div>

    <template #footer>
      <button class="cancel-btn" @click="emit('cancel')">
        {{ translations?.strict_mode_cancel || 'Cancel' }}
      </button>
      <button class="confirm-btn" @click="emit('confirm')">
        {{ translations?.acknowledged_continue || 'Acknowledged, continue!' }}
      </button>
    </template>
  </ModalDialog>
</template>

<style scoped>
.warning-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.warning-dialog-main {
  font-size: 13px;
  line-height: 1.55;
  color: var(--ev-c-text-2);
  margin: 0;
}

.cancel-btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background-color: transparent;
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  outline: none;
  transition: all 0.15s ease;
}

[data-theme='light'] .cancel-btn {
  border-color: rgba(0, 0, 0, 0.12);
}

.cancel-btn:hover {
  background-color: var(--color-background-soft);
}

.confirm-btn {
  padding: 8px 18px;
  border-radius: 8px;
  border: none;
  background-color: #ef4444;
  color: #ffffff;
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  outline: none;
  transition: all 0.15s ease;
}

.confirm-btn:hover {
  background-color: #dc2626;
}
</style>
