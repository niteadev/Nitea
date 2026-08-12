<!-- eslint-disable prettier/prettier -->

<script setup lang="ts">
import { ref, computed, markRaw, onMounted, onUnmounted } from 'vue'
import { Sun, Moon, Check, Settings, Heart, ChevronDown } from '@lucide/vue'
import * as flags from 'country-flag-icons/string/3x2'
import languageCatalog from '../languages/languages.json'
import ModalDialog from './ModalDialog.vue'

export interface LanguageItem {
  code: string
  country?: string
  name: string
  completion: number
}

const props = defineProps<{
  isOpen: boolean
  theme: 'dark' | 'light'
  countdownSeconds: number
  strictMode: boolean
  currentLanguage: string
  translations?: Record<string, string>
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update:theme', theme: 'dark' | 'light'): void
  (e: 'update:countdownSeconds', seconds: number): void
  (e: 'update:strictMode', strict: boolean): void
  (e: 'update:currentLanguage', langCode: string): void
  (e: 'open-credits'): void
}>()

const settingsIcon = markRaw(Settings)
const languages = ref<LanguageItem[]>([])
const isLoadingLanguages = ref(true)
const isDropdownOpen = ref(false)

const getFlagSvg = (countryCode?: string): string => {
  if (!countryCode) return ''
  const code = countryCode.toUpperCase()
  return flags[code] || ''
}

const selectedLanguageItem = computed(() => {
  return languages.value.find((l) => l.code === props.currentLanguage) || languages.value[0] || null
})

const fetchLanguagesList = async (): Promise<void> => {
  try {
    const list = await window.electron.ipcRenderer.invoke('fetch-languages')
    if (Array.isArray(list) && list.length > 0) {
      languages.value = list
      isLoadingLanguages.value = false
      return
    }
  } catch (e) {
    console.error('Error fetching languages list:', e)
  }

  languages.value = languageCatalog as LanguageItem[]
  isLoadingLanguages.value = false
}

onMounted(() => {
  fetchLanguagesList()
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

const dropdownRef = ref<HTMLElement | null>(null)

const handleClickOutside = (e: MouseEvent): void => {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    isDropdownOpen.value = false
  }
}

const selectTheme = (newTheme: 'dark' | 'light'): void => {
  emit('update:theme', newTheme)
}

const handleCountdownInput = (event: Event): void => {
  const target = event.target as HTMLInputElement
  const val = parseInt(target.value) || 10
  emit('update:countdownSeconds', Math.max(1, Math.min(60, val)))
}

const toggleStrictMode = (event: Event): void => {
  const target = event.target as HTMLInputElement
  emit('update:strictMode', target.checked)
}

const selectLanguage = (code: string): void => {
  emit('update:currentLanguage', code)
  isDropdownOpen.value = false
}
</script>

<template>
  <ModalDialog
    :is-open="isOpen"
    :title="translations?.settings || 'Settings'"
    :icon="settingsIcon"
    max-width="480px"
    :allow-overflow="true"
    @close="emit('close')"
  >
    <div class="settings-group">
      <!-- Theme Selection -->
      <div class="setting-item">
        <div class="setting-text">
          <label class="setting-label">{{ translations?.theme || 'Theme' }}</label>
        </div>
        <div class="theme-options">
          <button
            class="theme-btn"
            :class="{ active: theme === 'dark' }"
            @click="selectTheme('dark')"
          >
            <Moon :size="15" />
            <span>{{ translations?.dark || 'Dark' }}</span>
            <Check v-if="theme === 'dark'" :size="14" class="check-icon" />
          </button>

          <button
            class="theme-btn"
            :class="{ active: theme === 'light' }"
            @click="selectTheme('light')"
          >
            <Sun :size="15" />
            <span>{{ translations?.light || 'Light' }}</span>
            <Check v-if="theme === 'light'" :size="14" class="check-icon" />
          </button>
        </div>
      </div>

      <!-- Countdown Duration -->
      <div class="setting-item">
        <div class="setting-text">
          <label class="setting-label">{{ translations?.start_countdown || 'Start Countdown' }}</label>
          <span class="setting-desc">{{ translations?.start_countdown_desc || 'Delay duration before entering focus mode' }}</span>
        </div>
        <div class="countdown-input-wrap">
          <input
            type="number"
            min="1"
            max="60"
            :value="countdownSeconds"
            class="countdown-input"
            @input="handleCountdownInput"
          />
          <span class="unit-suffix">s</span>
        </div>
      </div>

      <!-- Strict Mode Toggle Switch -->
      <div class="setting-item">
        <div class="setting-text">
          <label class="setting-label">{{ translations?.strict_mode || 'Strict Mode' }}</label>
          <span class="setting-desc">{{ translations?.strict_mode_desc || 'Block emergency exit during focus session' }}</span>
        </div>
        <label class="toggle-switch">
          <input
            type="checkbox"
            :checked="strictMode"
            @change="toggleStrictMode"
          />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <!-- Language Dropdown Selector (NO ICON in label, uses country-flag-icons) -->
      <div v-if="languages.length > 0" class="setting-item language-setting-item">
        <div class="setting-text">
          <label class="setting-label">{{ translations?.language || 'Language' }}</label>
          <span class="setting-desc">{{ translations?.language_desc || 'Interface language & translation progress' }}</span>
        </div>

        <div ref="dropdownRef" class="lang-dropdown-wrapper">
          <button
            class="lang-dropdown-trigger"
            :class="{ open: isDropdownOpen }"
            @click.stop="isDropdownOpen = !isDropdownOpen"
          >
            <div v-if="selectedLanguageItem" class="selected-lang-info">
              <span
                v-if="selectedLanguageItem.country && getFlagSvg(selectedLanguageItem.country)"
                class="flag-svg"
                v-html="getFlagSvg(selectedLanguageItem.country)"
              ></span>
              <span class="selected-lang-name">{{ selectedLanguageItem.name }}</span>
            </div>
            <span v-else class="selected-lang-placeholder">Select Language</span>
            <ChevronDown :size="14" class="chevron-icon" :class="{ rotated: isDropdownOpen }" />
          </button>

          <!-- Dropdown Options List -->
          <Transition name="dropdown">
            <div v-if="isDropdownOpen" class="lang-dropdown-menu">
              <div
                v-for="lang in languages"
                :key="lang.code"
                class="lang-dropdown-option"
                :class="{ active: currentLanguage === lang.code }"
                @click="selectLanguage(lang.code)"
              >
                <div class="option-header">
                  <div class="option-left">
                    <span
                      v-if="lang.country && getFlagSvg(lang.country)"
                      class="flag-svg"
                      v-html="getFlagSvg(lang.country)"
                    ></span>
                    <span class="option-name">{{ lang.name }}</span>
                  </div>
                  <Check v-if="currentLanguage === lang.code" :size="13" class="option-check" />
                </div>
                <!-- Completion Progress Bar under language -->
                <div class="option-progress-wrap">
                  <div class="option-progress-track">
                    <div
                      class="option-progress-bar"
                      :style="{ width: lang.completion + '%' }"
                    ></div>
                  </div>
                  <span class="option-progress-text">{{ lang.completion }}%</span>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>

      <!-- Credits Section -->
      <div class="setting-item credits-row">
        <div class="setting-text">
          <label class="setting-label">{{ translations?.about_credits || 'About & Acknowledgments' }}</label>
        </div>
        <button class="credits-btn" @click="emit('open-credits')">
          <Heart :size="14" class="heart-icon" />
          <span>{{ translations?.view_credits || 'View Credits' }}</span>
        </button>
      </div>
    </div>
  </ModalDialog>
</template>

<style scoped>
.settings-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 4px 0;
}

.setting-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.setting-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
}

.setting-desc {
  font-size: 11px;
  color: var(--ev-c-text-2);
}

.theme-options {
  display: flex;
  gap: 10px;
}

.theme-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background-color: var(--color-background-soft);
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

[data-theme='light'] .theme-btn {
  border-color: rgba(0, 0, 0, 0.08);
}

.theme-btn:hover:not(.active) {
  background-color: var(--color-background-mute);
  border-color: rgba(255, 255, 255, 0.15);
}

[data-theme='light'] .theme-btn:hover:not(.active) {
  border-color: rgba(0, 0, 0, 0.15);
}

.theme-btn.active {
  border-color: transparent;
  background-color: rgba(255, 255, 255, 0.12);
  color: var(--color-text);
  font-weight: 600;
}

[data-theme='light'] .theme-btn.active {
  background-color: rgba(0, 0, 0, 0.1);
}

.check-icon {
  margin-left: 4px;
}

/* Language Dropdown Selector (country-flag-icons, NO label icon) */
.lang-dropdown-wrapper {
  position: relative;
  min-width: 170px;
}

.lang-dropdown-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  height: 38px;
  padding: 0 12px;
  border-radius: 8px;
  background-color: var(--color-background-soft);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: 13px;
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;
}

[data-theme='light'] .lang-dropdown-trigger {
  border-color: rgba(0, 0, 0, 0.08);
}

.lang-dropdown-trigger:hover {
  background-color: var(--color-background-mute);
}

.selected-lang-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.flag-svg {
  display: inline-flex;
  align-items: center;
  width: 18px;
  height: 12px;
  flex-shrink: 0;
  border-radius: 2px;
  overflow: hidden;
}

.flag-svg :deep(svg) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.selected-lang-name {
  font-weight: 600;
}

.chevron-icon {
  color: var(--ev-c-text-2);
  transition: transform 0.2s ease;
}

.chevron-icon.rotated {
  transform: rotate(180deg);
}

.lang-dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  width: 210px;
  max-height: 200px;
  overflow-y: auto;
  border-radius: 8px;
  background-color: var(--color-background-soft);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
  z-index: 999;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

[data-theme='light'] .lang-dropdown-menu {
  border-color: rgba(0, 0, 0, 0.1);
  box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.15);
}

.lang-dropdown-menu::-webkit-scrollbar {
  width: 4px;
}

.lang-dropdown-menu::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 4px;
}

.lang-dropdown-option {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.lang-dropdown-option:hover {
  background-color: var(--color-background-mute);
}

.lang-dropdown-option.active {
  background-color: rgba(59, 130, 246, 0.12);
}

.option-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.option-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.option-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text);
}

.option-check {
  color: #3b82f6;
}

.option-progress-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-left: 26px;
}

.option-progress-track {
  flex: 1;
  height: 3px;
  border-radius: 2px;
  background-color: rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

[data-theme='light'] .option-progress-track {
  background-color: rgba(0, 0, 0, 0.1);
}

.option-progress-bar {
  height: 100%;
  background-color: #3b82f6;
  border-radius: 2px;
}

.option-progress-text {
  font-size: 10px;
  color: var(--ev-c-text-2);
  min-width: 24px;
  text-align: right;
}

/* Dropdown Animation */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* Countdown Input Box with "s" suffix */
.countdown-input-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 8px;
  background-color: var(--color-background-soft);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

[data-theme='light'] .countdown-input-wrap {
  border-color: rgba(0, 0, 0, 0.08);
}

.countdown-input {
  width: 36px;
  height: 26px;
  background: transparent;
  border: none;
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  outline: none;
}

.countdown-input::-webkit-inner-spin-button,
.countdown-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.unit-suffix {
  font-size: 13px;
  font-weight: 600;
  color: var(--ev-c-text-2);
}

/* Toggle Switch */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background-color: rgba(255, 255, 255, 0.12);
  transition: 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  border-radius: 24px;
}

[data-theme='light'] .toggle-slider {
  background-color: rgba(0, 0, 0, 0.12);
}

.toggle-slider:before {
  position: absolute;
  content: '';
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: #ffffff;
  transition: 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  border-radius: 50%;
}

input:checked + .toggle-slider {
  background-color: #3b82f6;
}

input:checked + .toggle-slider:before {
  transform: translateX(20px);
}

/* Credits Button */
.credits-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background-color: var(--color-background-soft);
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;
}

[data-theme='light'] .credits-btn {
  border-color: rgba(0, 0, 0, 0.08);
}

.credits-btn:hover {
  background-color: var(--color-background-mute);
}

.heart-icon {
  color: #ec4899;
}
</style>
