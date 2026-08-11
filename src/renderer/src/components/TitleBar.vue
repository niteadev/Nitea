<script setup lang="ts">
import { Minus, Square, X } from '@lucide/vue'
import icnLight from '../assets/icn_light.png'

defineProps<{
  title?: string
  theme: 'dark' | 'light'
}>()

const minimize = (): void => {
  window.electron.ipcRenderer.send('window-minimize')
}

const maximize = (): void => {
  window.electron.ipcRenderer.send('window-maximize')
}

const close = (): void => {
  window.electron.ipcRenderer.send('window-close')
}
</script>

<template>
  <header class="titlebar">
    <div class="titlebar-title">
      <img :src="icnLight" alt="logo" class="titlebar-icon" />
      <span>{{ 'Nitea' }}</span>
    </div>
    <div class="titlebar-controls">
      <button class="control-btn" title="Minimize" @click="minimize">
        <Minus :size="13" />
      </button>
      <button class="control-btn" title="Maximize" @click="maximize">
        <Square :size="11" />
      </button>
      <button class="control-btn close-btn" title="Close" @click="close">
        <X :size="13" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.titlebar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  width: 100%;
  background-color: var(--color-titlebar-bg);
  backdrop-filter: blur(12px);
  -webkit-app-region: drag;
  user-select: none;
  border-bottom: none;
  box-sizing: border-box;
  padding: 0 8px 0 12px;
  color: var(--color-titlebar-text);
  font-family: var(--font-body);
  transition: background-color 0.3s ease, color 0.3s ease;
}

.titlebar-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.5px;
  font-family: var(--font-body);
}

.titlebar-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
  transition: opacity 0.2s ease;
}

.titlebar-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  -webkit-app-region: no-drag;
}

.control-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background-color: transparent;
  color: var(--color-titlebar-text);
  cursor: pointer;
  outline: none;
  transition: background-color 0.15s ease, color 0.15s ease, transform 0.1s ease;
  padding: 0;
  opacity: 0.8;
}

.control-btn:hover {
  background-color: rgba(255, 255, 255, 0.12);
  color: var(--color-text);
  opacity: 1;
}

[data-theme='light'] .control-btn:hover {
  background-color: rgba(0, 0, 0, 0.08);
}

.control-btn:active {
  transform: scale(0.95);
}
</style>
