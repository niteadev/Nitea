<script setup lang="ts">
import { X } from '@lucide/vue'

withDefaults(
  defineProps<{
    isOpen: boolean
    title?: string
    icon?: any
    iconColor?: string
    maxWidth?: string
    showClose?: boolean
    allowOverflow?: boolean
  }>(),
  {
    title: '',
    iconColor: 'var(--color-text)',
    maxWidth: '360px',
    showClose: true,
    allowOverflow: false
  }
)

const emit = defineEmits<{
  (e: 'close'): void
}>()
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="isOpen" class="modal-overlay" @click.self="emit('close')">
        <div class="modal-card" :class="{ 'allow-overflow': allowOverflow }" :style="{ maxWidth }">
          <div class="modal-header">
            <div class="header-left">
              <component :is="icon" v-if="icon" :size="18" class="header-icon" :style="{ color: iconColor }" />
              <h3 v-if="title" class="modal-title font-header">{{ title }}</h3>
              <slot name="title" />
            </div>
            <button v-if="showClose" class="close-btn" title="Close" @click="emit('close')">
              <X :size="14" />
            </button>
          </div>

          <div class="modal-body">
            <slot />
          </div>

          <div v-if="$slots.footer" class="modal-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.modal-card {
  width: 100%;
  max-width: 90vw;
  background-color: var(--color-modal-bg);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  color: var(--color-text);
  font-family: var(--font-body);
}

.modal-card.allow-overflow {
  overflow: visible;
}

[data-theme='light'] .modal-card {
  border-color: rgba(0, 0, 0, 0.08);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background-color: var(--color-background-soft);
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
}

[data-theme='light'] .modal-header {
  border-bottom-color: rgba(0, 0, 0, 0.06);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-icon {
  flex-shrink: 0;
}

.modal-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  color: var(--color-text);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--ev-c-text-2);
  cursor: pointer;
  outline: none;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.close-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
  color: var(--color-text);
}

[data-theme='light'] .close-btn:hover {
  background-color: rgba(0, 0, 0, 0.08);
}

.modal-body {
  padding: 20px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--color-text);
  border-bottom-left-radius: 12px;
  border-bottom-right-radius: 12px;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background-color: var(--color-background-soft);
  border-bottom-left-radius: 12px;
  border-bottom-right-radius: 12px;
}

[data-theme='light'] .modal-footer {
  border-top-color: rgba(0, 0, 0, 0.06);
}

/* Modal Transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
