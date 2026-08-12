<script setup lang="ts">
import { markRaw } from 'vue'
import { Heart, ExternalLink } from '@lucide/vue'
import ModalDialog from './ModalDialog.vue'
import pkg from '../../../../package.json'

defineProps<{
  isOpen: boolean
  translations?: Record<string, string>
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const heartIcon = markRaw(Heart)

const openNpmPackage = (packageName: string): void => {
  window.open(`https://www.npmjs.com/package/${packageName}`, '_blank')
}

const openLink = (url: string): void => {
  window.open(url, '_blank')
}

// Extract node modules credits directly from package.json dependencies
const dependenciesList = [
  { name: 'vue', version: pkg.devDependencies['vue'] || '^3.4.15' },
  { name: 'electron', version: pkg.devDependencies['electron'] || '^28.2.0' },
  { name: '@lucide/vue', version: pkg.dependencies['@lucide/vue'] || '^1.31.0' },
  { name: 'country-flag-icons', version: pkg.dependencies['country-flag-icons'] || '^1.6.20' },
  { name: '@crowdin/cli', version: pkg.devDependencies['@crowdin/cli'] || '^4.15.0' },
  { name: 'electron-updater', version: pkg.dependencies['electron-updater'] || '^6.8.9' },
  { name: 'electron-vite', version: pkg.devDependencies['electron-vite'] || '^2.0.0' },
  { name: 'electron-builder', version: pkg.devDependencies['electron-builder'] || '^24.9.1' },
  { name: '@electron-toolkit/utils', version: pkg.dependencies['@electron-toolkit/utils'] || '^3.0.0' },
  { name: '@electron-toolkit/preload', version: pkg.dependencies['@electron-toolkit/preload'] || '^3.0.0' },
  { name: 'vite', version: pkg.devDependencies['vite'] || '^5.0.12' },
  { name: 'typescript', version: pkg.devDependencies['typescript'] || '^5.3.3' }
]
</script>

<template>
  <ModalDialog
    :is-open="isOpen"
    :title="translations?.credits || 'Credits'"
    :icon="heartIcon"
    icon-color="#ec4899"
    max-width="440px"
    @close="emit('close')"
  >
    <div class="credits-content">
      <!-- Title Header (NO description under Nitea) -->
      <div class="project-header">
        <div class="project-name font-header">Nitea</div>
      </div>

      <!-- Node Modules Dependencies Single Column List -->
      <div class="credits-section">

        <div class="modules-list">
          <div
            v-for="item in dependenciesList"
            :key="item.name"
            class="module-card"
            title="Click to view on npm"
            @click="openNpmPackage(item.name)"
          >
            <div class="module-info">
              <span class="module-name">{{ item.name }}</span>
              <span class="module-ver">{{ item.version }}</span>
            </div>
            <ExternalLink :size="13" class="link-icon" />
          </div>
        </div>
      </div>

      <div class="credits-footer">
        <button class="github-btn" @click="openLink('https://github.com/oxideve')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path>
            <path d="M9 18c-4.51 2-5-2-7-2"></path>
          </svg>
          <span>{{ translations?.developed_by || 'Developed by oxideve' }}</span>
        </button>
      </div>
    </div>
  </ModalDialog>
</template>

<style scoped>
.credits-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.project-header {
  text-align: center;
  padding-bottom: 8px;
}

.project-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text);
}

.credits-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}

.section-icon {
  color: #ec4899;
}

/* Single Column List */
.modules-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 220px;
  overflow-y: auto;
  padding-right: 4px;
}

.modules-list::-webkit-scrollbar {
  width: 4px;
}

.modules-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 4px;
}

.module-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 8px;
  background-color: var(--color-background-soft);
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}

.module-card:hover {
  background-color: var(--color-background-mute);
  transform: translateY(-1px);
}

.module-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.module-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}

.module-ver {
  font-size: 12px;
  color: var(--ev-c-text-2);
  font-family: var(--font-body);
}

.link-icon {
  color: var(--ev-c-text-3);
  flex-shrink: 0;
  transition: color 0.15s ease;
}

.module-card:hover .link-icon {
  color: #ec4899;
}

.credits-footer {
  display: flex;
  justify-content: center;
  padding-top: 8px;
  border-top: 1px solid var(--color-background-mute);
}

.github-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  background-color: var(--color-background-soft);
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  outline: none;
  transition: background-color 0.15s ease;
}

.github-btn:hover {
  background-color: var(--color-background-mute);
}
</style>
