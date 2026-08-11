<script setup lang="ts">
import { markRaw } from 'vue'
import { Download, Clock, Loader2, ArrowRight } from '@lucide/vue'
import ModalDialog from './ModalDialog.vue'

withDefaults(
  defineProps<{
    isOpen: boolean
    currentVersion?: string
    versionInfo: { version: string; releaseNotes: string } | null
    isDownloading: boolean
    downloadPercent: number
  }>(),
  {
    currentVersion: '1.0.0'
  }
)

const emit = defineEmits<{
  (e: 'postpone'): void
  (e: 'download'): void
}>()

const updateIcon = markRaw(Download)
</script>

<template>
  <ModalDialog
    :is-open="isOpen"
    title="Update Available"
    :icon="updateIcon"
    icon-color="#3b82f6"
    max-width="440px"
    :show-close="false"
  >
    <div class="update-content">
      <!-- Description under title -->
      <p class="update-desc">
        A new version of <strong>Nitea</strong> is ready for installation.
      </p>


      <div class="version-migration-row">
        <span class="ver-text ver-current">{{ currentVersion }}</span>
        <ArrowRight :size="16" class="ver-arrow" />
        <span class="ver-text ver-new">{{ versionInfo?.version || '2.0.0' }}</span>
      </div>

      <!-- Scrollable Release Notes Box -->
      <div v-if="versionInfo?.releaseNotes" class="release-notes-box">
        <div class="notes-title">Release Notes</div>
        <div class="notes-body scrollable-notes">{{ versionInfo.releaseNotes }}</div>
      </div>

      <!-- Download Progress Bar -->
      <div v-if="isDownloading" class="progress-section">
        <div class="progress-header">
          <span>Downloading Update...</span>
          <span>{{ Math.round(downloadPercent) }}%</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" :style="{ width: `${downloadPercent}%` }"></div>
        </div>
      </div>
    </div>

    <template #footer>
      <div v-if="!isDownloading" class="update-actions">
        <button class="postpone-btn" @click="emit('postpone')">
          <Clock :size="14" />
          <span>Postpone</span>
        </button>

        <button class="download-btn" @click="emit('download')">
          <Download :size="14" />
          <span>Download and install</span>
        </button>
      </div>

      <div v-else class="downloading-status">
        <Loader2 :size="16" class="spin-icon" />
        <span>The update will be installed after download...</span>
      </div>
    </template>
  </ModalDialog>
</template>

<style scoped>
.update-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.update-desc {
  font-size: 13px;
  margin: 0;
  color: var(--ev-c-text-2);
  line-height: 1.4;
}

/* Centered & Enlarged Version Migration Row with Standard Font */
.version-migration-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 12px 16px;
  border-radius: 8px;
  background-color: var(--color-background-soft);
}

.ver-text {
  font-size: 17px;
  font-weight: 600;
  font-family: var(--font-body);
}

.ver-current {
  color: var(--ev-c-text-2);
}

.ver-arrow {
  color: var(--ev-c-text-3);
  flex-shrink: 0;
}

.ver-new {
  color: #60a5fa;
  font-weight: 700;
}

/* Scrollable Release Notes Box */
.release-notes-box {
  padding: 10px 12px;
  border-radius: 8px;
  background-color: var(--color-background-soft);
  font-size: 12px;
}

.notes-title {
  font-weight: 600;
  color: var(--ev-c-text-2);
  margin-bottom: 6px;
}

.notes-body.scrollable-notes {
  max-height: 110px;
  overflow-y: auto;
  color: var(--color-text);
  line-height: 1.45;
  white-space: pre-wrap;
  padding-right: 4px;
}

/* Scrollbar styling */
.scrollable-notes::-webkit-scrollbar {
  width: 4px;
}

.scrollable-notes::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.progress-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--ev-c-text-2);
}

.progress-bar-bg {
  width: 100%;
  height: 6px;
  border-radius: 4px;
  background-color: var(--color-background-soft);
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background-color: #3b82f6;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.update-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  width: 100%;
}

.postpone-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background-color: var(--color-background-soft);
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  outline: none;
  transition: all 0.15s ease;
}

[data-theme='light'] .postpone-btn {
  border-color: rgba(0, 0, 0, 0.08);
}

.postpone-btn:hover {
  background-color: var(--color-background-mute);
}

.download-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  background-color: #2563eb;
  color: #ffffff;
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  outline: none;
  transition: background-color 0.15s ease;
}

.download-btn:hover {
  background-color: #1d4ed8;
}

.downloading-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--ev-c-text-2);
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
