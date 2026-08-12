<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
import { Settings, Loader2, X, Clock, Check } from '@lucide/vue'
import TitleBar from './components/TitleBar.vue'
import SettingsModal from './components/SettingsModal.vue'
import DevWarningModal from './components/DevWarningModal.vue'
import UpdateModal from './components/UpdateModal.vue'
import CreditsModal from './components/CreditsModal.vue'
import ToastNotification, { type ToastItem } from './components/ToastNotification.vue'
import icnLight from './assets/icn_light.png'
import pkg from '../../../package.json'

interface AppBoxData {
  image?: string
  text: string
  description?: string
  link: string
  valid_until?: string | null
}

const isFullscreenMode = ref(
  window.location.search.includes('mode=fullscreen') || window.location.hash.includes('fullscreen')
)

const isDevPanelMode = ref(
  window.location.search.includes('mode=dev-panel') || window.location.hash.includes('dev-panel')
)

const isSplashMode = ref(
  window.location.search.includes('mode=splash') || window.location.hash.includes('splash')
)

const theme = ref<'dark' | 'light'>('dark')
const isSettingsOpen = ref(false)
const isDevWarningOpen = ref(false)
const isCreditsOpen = ref(false)
const version = ref(pkg.version)

// Language & Translation state
const currentLanguage = ref(localStorage.getItem('language') || 'en')
const translations = ref<Record<string, string>>({})

const fetchTranslations = async (langCode: string): Promise<void> => {
  try {
    const res = await window.electron.ipcRenderer.invoke('fetch-locale-strings', langCode)
    if (res && typeof res === 'object') {
      translations.value = res
    }
  } catch (e) {
    // Ignore translation load error
  }
}

watch(currentLanguage, (newLang) => {
  if (newLang) {
    localStorage.setItem('language', newLang)
    fetchTranslations(newLang)
  }
})

// Settings state & tracking
const countdownSeconds = ref(parseInt(localStorage.getItem('countdownDuration') || '10') || 10)
const strictMode = ref(localStorage.getItem('strictMode') !== 'false')

// Toast System State
const toasts = ref<ToastItem[]>([])

const removeToast = (id: string): void => {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

const addToast = (toast: {
  type: 'error' | 'warning' | 'info' | 'success'
  title: string
  message?: string | null
  effect?: 'confetti' | null
}): void => {
  const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
  toasts.value.push({ id, ...toast })

  setTimeout(() => {
    removeToast(id)
  }, 4000)
}

const openSettingsModal = (): void => {
  isSettingsOpen.value = true
}

const closeSettingsModal = (): void => {
  isSettingsOpen.value = false
}

const handleThemeUpdate = (newTheme: 'dark' | 'light'): void => {
  try {
    setTheme(newTheme)
    addToast({
      type: 'success',
      title: translations.value?.settings_has_been_updated || 'Settings has been updated',
      message: null
    })
  } catch (e) {
    addToast({
      type: 'error',
      title: translations.value?.setting_update_failed || 'Setting Update Failed',
      message: String(e)
    })
  }
}

const handleCountdownUpdate = (seconds: number): void => {
  try {
    countdownSeconds.value = seconds
    localStorage.setItem('countdownDuration', String(seconds))
    addToast({
      type: 'success',
      title: translations.value?.settings_has_been_updated || 'Settings has been updated',
      message: null
    })
  } catch (e) {
    addToast({
      type: 'error',
      title: translations.value?.setting_update_failed || 'Setting Update Failed',
      message: String(e)
    })
  }
}

const handleLanguageUpdate = async (langCode: string): Promise<void> => {
  try {
    currentLanguage.value = langCode
    localStorage.setItem('language', langCode)
    await fetchTranslations(langCode)
    addToast({
      type: 'success',
      title: translations.value?.settings_has_been_updated || 'Settings has been updated',
      message: null
    })
  } catch (e) {
    addToast({
      type: 'error',
      title: translations.value?.setting_update_failed || 'Setting Update Failed',
      message: String(e)
    })
  }
}

const handleStrictModeUpdate = async (val: boolean): Promise<void> => {
  try {
    strictMode.value = val
    const isValid = await window.electron.ipcRenderer.invoke('validate-strict-mode-admin', val)
    if (!isValid) {
      strictMode.value = false
      localStorage.setItem('strictMode', 'false')
      addToast({
        type: 'error',
        title: translations.value?.settings_save_error || 'Settings save error',
        message: null
      })
    } else {
      localStorage.setItem('strictMode', String(val))
      addToast({
        type: 'success',
        title: translations.value?.settings_has_been_updated || 'Settings has been updated',
        message: null
      })
    }
  } catch (e) {
    addToast({
      type: 'error',
      title: translations.value?.settings_save_error || 'Settings save error',
      message: null
    })
  }
}



// Parse if running in forced standard mode or dev
const isDev = ref(import.meta.env.DEV && !window.location.search.includes('mode=standard'))

// Auto Updater & Launch Loading Screen state
const isCheckingUpdate = ref(true)
const isUpdateAvailable = ref(false)
const isDownloadingUpdate = ref(false)
const updatePercent = ref(0)
const updateVersionInfo = ref<{ version: string; releaseNotes: string } | null>(null)

// App Box (Promo Widget) state - STRICTLY NO HARDCODED DATA
const appBoxData = ref<AppBoxData | null>(null)
const isAppBoxLoading = ref(false)

const handleImageError = (e: Event): void => {
  const target = e.target as HTMLImageElement
  if (target) {
    target.style.display = 'none'
  }
}

const fetchAppBoxData = async (): Promise<void> => {
  if (!navigator.onLine) {
    appBoxData.value = null
    return
  }
  isAppBoxLoading.value = true
  try {
    const data = await window.electron.ipcRenderer.invoke('fetch-app-box')
    if (data && data.text && data.link) {
      if (data.valid_until) {
        const expiry = new Date(data.valid_until).getTime()
        if (!isNaN(expiry) && Date.now() > expiry) {
          // Expired ad box -> do not show box!
          appBoxData.value = null
          return
        }
      }
      appBoxData.value = data
    } else {
      appBoxData.value = null
    }
  } catch (e) {
    appBoxData.value = null
  } finally {
    isAppBoxLoading.value = false
  }
}

const openAppBoxLink = (): void => {
  if (appBoxData.value?.link) {
    window.open(appBoxData.value.link, '_blank')
  }
}

// Live Clock & Fullscreen Countdown state
const currentTimeStr = ref('')
const remainingSeconds = ref(10)
let liveClockInterval: ReturnType<typeof setInterval> | null = null
let fullscreenTimerInterval: ReturnType<typeof setInterval> | null = null

const pad2 = (val: string | number): string => {
  const num = parseInt(String(val)) || 0
  return num < 10 ? `0${num}` : `${num}`
}

const updateLiveClock = (): void => {
  const d = new Date()
  currentTimeStr.value = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

const formattedRemainingTime = computed(() => {
  const s = Math.max(0, remainingSeconds.value)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${pad2(h)}:${pad2(m)}:${pad2(sec)}`
})

// Time duration selection (HH:MM:SS)
const isTimePickerOpen = ref(false)
const hoursInput = ref('00')
const minutesInput = ref('00')
const secondsInput = ref('10')

const formatInputs = (): void => {
  hoursInput.value = pad2(hoursInput.value)
  minutesInput.value = pad2(minutesInput.value)
  secondsInput.value = pad2(secondsInput.value)
}

const totalDurationSeconds = computed(() => {
  const h = parseInt(hoursInput.value) || 0
  const m = parseInt(minutesInput.value) || 0
  const s = parseInt(secondsInput.value) || 0
  const total = h * 3600 + m * 60 + s
  return total > 0 ? total : 10 // fallback to at least 10s
})

const confirmTimePicker = (): void => {
  formatInputs()
  isTimePickerOpen.value = false
}

// Countdown & Loading logic for start button
const isCounting = ref(false)
const isLoading = ref(false)
const isHovered = ref(false)
const countdownValue = ref(10)
let timer: ReturnType<typeof setInterval> | null = null

const resetStartButton = (): void => {
  isCounting.value = false
  isLoading.value = false
  countdownValue.value = countdownSeconds.value
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

const abortCountdown = (): void => {
  resetStartButton()
}

const handleButtonClick = (): void => {
  if (isCounting.value) {
    abortCountdown()
    return
  }
  if (!isLoading.value) {
    startCountdown()
  }
}

const startCountdown = (): void => {
  if (isCounting.value || isLoading.value) return

  isCounting.value = true
  isLoading.value = false
  countdownValue.value = countdownSeconds.value

  if (timer) clearInterval(timer)

  timer = setInterval(() => {
    if (countdownValue.value > 1) {
      countdownValue.value--
    } else {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
      countdownValue.value = 0
      isCounting.value = false
      isLoading.value = true

      // Send ping immediately at 0
      window.electron.ipcRenderer.send('ping')

      // After 1 second, open the new borderless fullscreen window with duration
      setTimeout(() => {
        window.electron.ipcRenderer.send('open-fullscreen-screen', {
          durationSeconds: totalDurationSeconds.value
        })
      }, 1000)
    }
  }, 1000)
}

// Dev Panel Actions
const sendDummyUpdate = (): void => {
  window.electron.ipcRenderer.send('trigger-dummy-update')
}

const triggerToast = (
  type: 'error' | 'warning' | 'info' | 'success',
  withDesc = true,
  effect: 'confetti' | null = null
): void => {
  const titles = {
    error: 'System Error',
    warning: 'Warning Alert',
    info: 'Information',
    success: 'Goal Completed!'
  }
  const messages = {
    error: 'Failed to synchronize local workspace state.',
    warning: 'System resources are running low.',
    info: 'Settings have been applied successfully.',
    success: 'Great job! Focus session completed.'
  }
  window.electron.ipcRenderer.send('trigger-toast', {
    type,
    title: titles[type],
    message: withDesc ? messages[type] : null,
    effect
  })
}

const switchToStandardMode = (): void => {
  window.electron.ipcRenderer.send('switch-to-standard-mode')
}

// Keyboard listener for Fullscreen mode (Alt+F4 blocked completely; in dev or if strictMode is disabled, press 'X' to close; in DEV MODE ONLY, press 'F' for windowed mode)
const handleKeyDown = (e: KeyboardEvent): void => {
  // Block Alt+F4 completely
  if ((e.altKey && (e.key === 'F4' || e.key === 'f4')) || (e.code === 'F4' && e.altKey)) {
    e.preventDefault()
    e.stopPropagation()
    return
  }

  if ((!strictMode.value || isDev.value) && (e.key === 'x' || e.key === 'X')) {
    window.electron.ipcRenderer.send('window-close')
  }
  if (isDev.value && (e.key === 'f' || e.key === 'F')) {
    window.electron.ipcRenderer.send('toggle-fullscreen-windowed')
  }
}

// Auto Updater actions
const postponeUpdate = (): void => {
  isUpdateAvailable.value = false
  isCheckingUpdate.value = false
}

const startDownloadUpdate = (): void => {
  isDownloadingUpdate.value = true
  updatePercent.value = 0
  window.electron.ipcRenderer.send('start-download-update')
}

onMounted(() => {
  if (isSplashMode.value) {
    fetchTranslations(currentLanguage.value)
    return
  }

  if (isDevPanelMode.value) {
    return
  }

  if (isFullscreenMode.value) {
    fetchTranslations(currentLanguage.value)
    isCheckingUpdate.value = false
    const urlParams = new URLSearchParams(window.location.search)
    const dur = parseInt(urlParams.get('duration') || '10') || 10
    remainingSeconds.value = dur

    updateLiveClock()
    liveClockInterval = setInterval(updateLiveClock, 1000)

    fullscreenTimerInterval = setInterval(() => {
      if (remainingSeconds.value > 0) {
        remainingSeconds.value--
      } else {
        if (fullscreenTimerInterval) clearInterval(fullscreenTimerInterval)
      }
    }, 1000)

    window.addEventListener('keydown', handleKeyDown)
    return
  }

  // Set up Auto Updater listeners
  window.electron.ipcRenderer.on('update-available', (_, info) => {
    updateVersionInfo.value = info
    isUpdateAvailable.value = true
    isCheckingUpdate.value = true
  })

  window.electron.ipcRenderer.on('update-not-available', () => {
    if (!isUpdateAvailable.value) {
      isCheckingUpdate.value = false
    }
  })

  window.electron.ipcRenderer.on('update-download-progress', (_, data) => {
    updatePercent.value = data.percent
  })

  window.electron.ipcRenderer.on('reset-start-button', () => {
    resetStartButton()
  })

  window.electron.ipcRenderer.on('strict-mode-updated', (_, enabled: boolean) => {
    strictMode.value = enabled
    localStorage.setItem('strictMode', String(enabled))
  })

  // Toast IPC listener
  window.electron.ipcRenderer.on('show-toast', (_, toastData) => {
    addToast(toastData)
  })

  // Trigger update check on open
  window.electron.ipcRenderer.send('check-for-updates')

  // Fetch App Box Data from GitHub once on open
  fetchAppBoxData()

  // Fetch locale strings
  fetchTranslations(currentLanguage.value)

  // Listen to network status online/offline
  window.addEventListener('online', fetchAppBoxData)
  window.addEventListener('offline', () => {
    appBoxData.value = null
  })

  // Fallback: If no update found after 2.5s and not in update available state, hide loading screen
  setTimeout(() => {
    if (!isUpdateAvailable.value) {
      isCheckingUpdate.value = false
    }
  }, 2500)

  const savedTheme = (localStorage.getItem('theme') as 'dark' | 'light') || 'dark'
  setTheme(savedTheme)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
  if (liveClockInterval) clearInterval(liveClockInterval)
  if (fullscreenTimerInterval) clearInterval(fullscreenTimerInterval)
  if (isFullscreenMode.value) {
    window.removeEventListener('keydown', handleKeyDown)
  }
})

const setTheme = (newTheme: 'dark' | 'light'): void => {
  theme.value = newTheme
  document.documentElement.setAttribute('data-theme', newTheme)
  localStorage.setItem('theme', newTheme)
}

watch(theme, (newTheme) => {
  if (!isFullscreenMode.value && !isDevPanelMode.value) {
    document.documentElement.setAttribute('data-theme', newTheme)
  }
})
</script>

<template>
  <!-- Toast Notification Container -->
  <ToastNotification :toasts="toasts" />

  <!-- Dedicated Small Borderless Splash Window View -->
  <div v-if="isSplashMode" class="splash-fullscreen-container">
    <div class="splash-window-card">
      <div class="pulse-logo-wrapper">
        <img :src="icnLight" alt="Nitea" class="pulsing-logo" />
      </div>
      <div class="loading-status-text">
        {{ translations.loading_settings || 'Caricamento impostazioni...' }}
      </div>
    </div>
  </div>

  <!-- Dev Control Panel Window (Pure WinForm Style) -->
  <div v-else-if="isDevPanelMode" class="dev-panel-container">
    <div class="dev-panel-card">
      <div class="dev-panel-title">Dev Control Panel</div>
      <div class="dev-panel-buttons">
        <button class="dummy-update-btn" @click="sendDummyUpdate">
          Dummy Update
        </button>
        <button class="toast-btn toast-btn-success" @click="triggerToast('success', true, 'confetti')">
          Success Toast (Confetti)
        </button>
        <button class="toast-btn toast-btn-error" @click="triggerToast('error', true)">
          Error Toast (With Desc)
        </button>
        <button class="toast-btn toast-btn-warning" @click="triggerToast('warning', false)">
          Warning Toast (Title Only)
        </button>
        <button class="toast-btn toast-btn-info" @click="triggerToast('info', true)">
          Info Toast (With Desc)
        </button>
        <button class="standard-mode-btn" @click="switchToStandardMode">
          Switch to Standard Mode
        </button>
      </div>
    </div>
  </div>

  <!-- Fullscreen Mode View (Full Black + Aurora BG + Live Clock + Big Countdown) -->
  <div v-else-if="isFullscreenMode" class="fullscreen-black-screen">
    <!-- Aurora Glow Effects behind content -->
    <div class="aurora-viewport" aria-hidden="true">
      <div class="aurora-glow aurora-purple"></div>
      <div class="aurora-glow aurora-pink"></div>
    </div>

    <!-- Top Right Current Time Button (HH:MM:SS) -->
    <div class="top-right-clock-btn font-header">
      {{ currentTimeStr }}
    </div>

    <!-- Centered Big Countdown (HH:MM:SS) -->
    <main class="fullscreen-center-content">
      <div class="big-timer-text font-header">
        {{ formattedRemainingTime }}
      </div>
    </main>
  </div>

  <!-- Standard App View -->
  <template v-else>
    <TitleBar title="nitea" :theme="theme" />

    <!-- Aurora Glow Effects spanning entire background behind text -->
    <div class="aurora-viewport" aria-hidden="true">
      <div class="aurora-glow aurora-purple"></div>
      <div class="aurora-glow aurora-pink"></div>
    </div>

    <!-- Settings Button in top right corner -->
    <button
      class="settings-corner-btn"
      :title="translations.settings || 'Settings'"
      @click="openSettingsModal"
    >
      <Settings :size="16" />
    </button>

    <main class="app-content">
      <h1 class="header-text">
        {{ translations.header_title || 'Unleash Your Potential. Master Your Focus.' }}
      </h1>

      <!-- Buttons row: Start Button + Expandable Clock Duration Button -->
      <div class="action-buttons-group">
        <button
          class="plain-start-btn"
          :class="{ 'is-counting': isCounting, 'is-loading': isLoading }"
          :disabled="isLoading"
          @mouseenter="isHovered = true"
          @mouseleave="isHovered = false"
          @click="handleButtonClick"
        >
          <Transition name="text-fade" mode="out-in">
            <span v-if="isLoading" key="loading" class="spinner-wrapper">
              <Loader2 :size="18" class="spin-icon" />
            </span>
            <span v-else-if="isCounting && isHovered" key="abort" class="abort-wrapper" :title="translations.click_to_abort || 'Click to abort countdown'">
              <X :size="18" />
            </span>
            <span v-else-if="isCounting" :key="countdownValue">
              {{ countdownValue }}
            </span>
            <span v-else key="start">
              {{ translations.start_now || 'Start Now' }}
            </span>
          </Transition>
        </button>

        <!-- Expandable Clock Time Picker with continuous synchronized width transition -->
        <div class="clock-control-wrapper" :class="{ expanded: isTimePickerOpen }">
          <button
            class="clock-icon-btn"
            :class="{ hidden: isTimePickerOpen }"
            :title="translations.set_duration || 'Set Fullscreen Duration (HH:MM:SS)'"
            :disabled="isCounting || isLoading"
            @click="isTimePickerOpen = true"
          >
            <Clock :size="16" />
          </button>

          <div class="time-picker-expanded" :class="{ visible: isTimePickerOpen }">
            <div class="time-inputs">
              <input
                v-model="hoursInput"
                type="text"
                maxlength="2"
                class="time-input"
                placeholder="HH"
                @blur="formatInputs"
              />
              <span class="time-sep">:</span>
              <input
                v-model="minutesInput"
                type="text"
                maxlength="2"
                class="time-input"
                placeholder="MM"
                @blur="formatInputs"
              />
              <span class="time-sep">:</span>
              <input
                v-model="secondsInput"
                type="text"
                maxlength="2"
                class="time-input"
                placeholder="SS"
                @blur="formatInputs"
              />
            </div>
            <button class="confirm-time-btn" :title="translations.confirm_duration || 'Confirm Duration'" @click="confirmTimePicker">
              <Check :size="14" />
            </button>
          </div>
        </div>
      </div>
    </main>

    <!-- Bottom Right Semi-Transparent Promo / App Box (STRICTLY NO HARDCODED DATA, Hidden on error or null or valid_until expired) -->
    <div v-if="appBoxData" class="bottom-right-promo-wrap">
      <div class="semi-transparent-appbox" @click="openAppBoxLink">
        <img
          v-if="appBoxData.image"
          :src="appBoxData.image"
          alt="promo"
          class="appbox-img"
          @error="handleImageError"
        />
        <div class="appbox-text-content">
          <div class="appbox-title font-header">{{ appBoxData.text }}</div>
          <div v-if="appBoxData.description" class="appbox-desc">{{ appBoxData.description }}</div>
        </div>
      </div>
    </div>

    <!-- Version & DEV PREVIEW anchored at bottom of page with padding 15px -->
    <footer class="bottom-footer">
      <div class="version-text">{{ translations.version || 'Version' }} {{ version }}</div>
      <button
        v-if="isDev"
        class="dev-warning-btn"
        :title="translations.dev_preview_tooltip || 'Click for build security warning'"
        @click="isDevWarningOpen = true"
      >
        {{ translations.dev_preview || 'DEV PREVIEW' }}
      </button>
    </footer>

    <!-- Modals -->
    <SettingsModal
      :is-open="isSettingsOpen"
      :theme="theme"
      :countdown-seconds="countdownSeconds"
      :strict-mode="strictMode"
      :current-language="currentLanguage"
      :translations="translations"
      @close="closeSettingsModal"
      @update:theme="handleThemeUpdate"
      @update:countdown-seconds="handleCountdownUpdate"
      @update:strict-mode="handleStrictModeUpdate"
      @update:current-language="handleLanguageUpdate"
      @open-credits="isCreditsOpen = true"
    />

    <CreditsModal
      :is-open="isCreditsOpen"
      :translations="translations"
      @close="isCreditsOpen = false"
    />

    <DevWarningModal
      :is-open="isDevWarningOpen"
      :translations="translations"
      @close="isDevWarningOpen = false"
    />

    <UpdateModal
      :is-open="isUpdateAvailable"
      :current-version="version"
      :version-info="updateVersionInfo"
      :is-downloading="isDownloadingUpdate"
      :download-percent="updatePercent"
      :translations="translations"
      @postpone="postponeUpdate"
      @download="startDownloadUpdate"
    />
  </template>
</template>

<style scoped>
/* Dev Control Panel (Pure WinForm Style) */
.dev-panel-container {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  background-color: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: Tahoma, 'Segoe UI', Geneva, Verdana, sans-serif;
  color: #000000;
  user-select: none;
}

.dev-panel-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 20px 24px;
  background-color: #ffffff;
  border: 1px solid #a0a0a0;
  box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.1);
  width: 300px;
}

.dev-panel-title {
  font-size: 13px;
  font-weight: bold;
  color: #333333;
}

.dev-panel-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.dummy-update-btn,
.standard-mode-btn,
.toast-btn {
  padding: 7px 14px;
  font-size: 12px;
  font-family: Tahoma, sans-serif;
  background-color: #e1e1e1;
  border: 1px solid #adadad;
  cursor: pointer;
  width: 100%;
}

.toast-btn-success:hover {
  background-color: #d1fae5;
  border-color: #34d399;
}

.toast-btn-error:hover {
  background-color: #fde8e8;
  border-color: #f87171;
}

.toast-btn-warning:hover {
  background-color: #fef3c7;
  border-color: #fbbf24;
}

.toast-btn-info:hover {
  background-color: #e0f2fe;
  border-color: #38bdf8;
}

.dummy-update-btn:hover,
.standard-mode-btn:hover {
  background-color: #e5f1fb;
  border-color: #0078d7;
}

/* Dedicated Small Splash Window Container */
.splash-fullscreen-container {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  z-index: 99998;
  background-color: var(--zinc-950);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

[data-theme='light'] .splash-fullscreen-container {
  background-color: var(--zinc-50);
}

/* Small Splash Window Card (Square-ish, slightly larger height: 320px x 370px) */
.splash-window-card {
  width: 320px;
  height: 370px;
  border-radius: 0;
  background-color: rgba(24, 24, 27, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 32px;
  padding: 32px 24px;
  user-select: none;
}

[data-theme='light'] .splash-window-card {
  background-color: rgba(255, 255, 255, 0.85);
  border-color: rgba(0, 0, 0, 0.08);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
}

/* Loading Overlay Fade Screen Transition */
.fade-screen-leave-active {
  transition: opacity 0.75s cubic-bezier(0.16, 1, 0.3, 1), transform 0.75s cubic-bezier(0.16, 1, 0.3, 1);
}

.fade-screen-leave-to {
  opacity: 0;
  transform: scale(1.04);
}

.pulse-logo-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Logo Pulsing Opacity ONLY (No scale / zoom-in-out) */
.pulsing-logo {
  width: 100px;
  height: 100px;
  object-fit: contain;
  animation: pulseOpacity 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulseOpacity {
  0%, 100% {
    opacity: 0.35;
    filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.15));
  }
  50% {
    opacity: 1;
    filter: drop-shadow(0 0 24px rgba(255, 255, 255, 0.4));
  }
}

.loading-status-text {
  font-size: 13px;
  font-weight: 500;
  color: var(--ev-c-text-2);
  letter-spacing: 0.3px;
  font-family: var(--font-body);
  text-align: center;
}

/* Fullscreen Black Screen & View */
.fullscreen-black-screen {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  background-color: #000000;
  z-index: 999999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  user-select: none;
  overflow: hidden;
}

.top-right-clock-btn {
  position: fixed;
  top: 24px;
  right: 28px;
  z-index: 20;
  padding: 8px 16px;
  border-radius: 8px;
  background-color: rgba(255, 255, 255, 0.07);
  backdrop-filter: blur(12px);
  color: rgba(255, 255, 255, 0.85);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.fullscreen-center-content {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}

.big-timer-text {
  font-size: 96px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: -0.04em;
  line-height: 1;
  text-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

/* Background Aurora Viewport (behind everything) */
.aurora-viewport {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.aurora-glow {
  position: absolute;
  border-radius: 50%;
  opacity: 0;
  animation: auroraFadeIn 2.5s ease-out 0.2s forwards, auroraFloat 14s ease-in-out infinite alternate;
}

.aurora-purple {
  width: 75vw;
  height: 75vh;
  top: 10vh;
  left: 5vw;
  background: radial-gradient(circle, rgba(168, 85, 247, 0.32) 0%, rgba(147, 51, 234, 0.14) 50%, transparent 75%);
  filter: blur(90px);
}

.aurora-pink {
  width: 70vw;
  height: 70vh;
  bottom: 10vh;
  right: 5vw;
  background: radial-gradient(circle, rgba(236, 72, 153, 0.28) 0%, rgba(219, 39, 119, 0.12) 50%, transparent 75%);
  filter: blur(90px);
  animation-delay: 0.5s, 1s;
}

@keyframes auroraFadeIn {
  from {
    opacity: 0;
    transform: scale(0.6);
  }
  to {
    opacity: 0.85;
    transform: scale(1);
  }
}

@keyframes auroraFloat {
  0% {
    transform: translate(-40px, -25px) rotate(0deg);
  }
  50% {
    transform: translate(40px, 25px) rotate(5deg);
  }
  100% {
    transform: translate(-25px, 40px) rotate(-5deg);
  }
}

.settings-corner-btn {
  position: fixed;
  top: 48px;
  right: 16px;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: none;
  background: rgba(255, 255, 255, 0.07);
  backdrop-filter: blur(8px);
  color: var(--color-text);
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;
}

[data-theme='light'] .settings-corner-btn {
  background: rgba(0, 0, 0, 0.05);
}

.settings-corner-btn:hover {
  background: rgba(255, 255, 255, 0.14);
}

[data-theme='light'] .settings-corner-btn:hover {
  background: rgba(0, 0, 0, 0.1);
}

.app-content {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 80px);
  margin-top: 36px;
  padding: 24px;
  text-align: center;
}

.header-text {
  position: relative;
  z-index: 10;
  font-size: 48px;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: -0.04em;
  line-height: 1.08;
  margin-bottom: 28px;
  max-width: 800px;
}

.action-buttons-group {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

/* Borderless, slightly transparent action button */
.plain-start-btn {
  min-width: 120px;
  height: 44px;
  padding: 0 24px;
  font-size: 15px;
  font-weight: 600;
  font-family: var(--font-body);
  border-radius: 8px;
  border: none;
  background-color: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px);
  color: var(--color-text);
  cursor: pointer;
  outline: none;
  transition: background-color 0.2s ease, opacity 0.2s ease, transform 0.1s ease, color 0.2s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

[data-theme='light'] .plain-start-btn {
  background-color: rgba(0, 0, 0, 0.06);
}

.plain-start-btn:hover:not(:disabled) {
  background-color: rgba(255, 255, 255, 0.15);
  transform: translateY(-1px);
}

[data-theme='light'] .plain-start-btn:hover:not(:disabled) {
  background-color: rgba(0, 0, 0, 0.12);
}

/* Red-ish background on hover during countdown to abort */
.plain-start-btn.is-counting:hover {
  background-color: rgba(239, 68, 68, 0.3) !important;
  color: #ffffff !important;
}

.plain-start-btn:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

/* Clock Duration Wrapper with Snug Tight Width Transition (px-10) */
.clock-control-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  height: 44px;
  width: 44px;
  border-radius: 8px;
  background-color: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px);
  border: none;
  overflow: hidden;
  transition: width 0.35s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.3s ease;
  flex-shrink: 0;
}

[data-theme='light'] .clock-control-wrapper {
  background-color: rgba(0, 0, 0, 0.06);
}

.clock-control-wrapper.expanded {
  width: 117px;
}

.clock-icon-btn {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  outline: none;
  opacity: 1;
  visibility: visible;
  transition: opacity 0.25s ease, visibility 0.25s ease;
}

.clock-icon-btn.hidden {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

.clock-icon-btn:hover:not(:disabled) {
  background-color: rgba(255, 255, 255, 0.07);
}

[data-theme='light'] .clock-icon-btn:hover:not(:disabled) {
  background-color: rgba(0, 0, 0, 0.06);
}

.clock-icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.time-picker-expanded {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 3px;
  width: 117px;
  height: 44px;
  padding: 0 10px;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  white-space: nowrap;
  transition: opacity 0.25s ease 0.05s, visibility 0.25s ease;
}

.time-picker-expanded.visible {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

.time-inputs {
  display: flex;
  align-items: center;
  gap: 1px;
}

.time-input {
  width: 20px;
  height: 28px;
  background: transparent;
  border: none;
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  outline: none;
  padding: 0;
}

.time-input::selection {
  background: rgba(255, 255, 255, 0.3);
  color: var(--color-text);
}

.time-sep {
  font-size: 12px;
  font-weight: 600;
  color: var(--ev-c-text-2);
}

.confirm-time-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 5px;
  border: none;
  background-color: rgba(255, 255, 255, 0.15);
  color: var(--color-text);
  cursor: pointer;
  outline: none;
  transition: background-color 0.15s ease;
  margin-left: 1px;
}

.confirm-time-btn:hover {
  background-color: rgba(255, 255, 255, 0.28);
}

[data-theme='light'] .confirm-time-btn {
  background-color: rgba(0, 0, 0, 0.12);
}

[data-theme='light'] .confirm-time-btn:hover {
  background-color: rgba(0, 0, 0, 0.22);
}

/* Bottom Right Promo / App Box (Borderless, Strictly NO hardcoded data) */
.bottom-right-promo-wrap {
  position: fixed;
  bottom: 15px;
  right: 15px;
  z-index: 95;
  display: flex;
  align-items: center;
}

.semi-transparent-appbox {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  background-color: rgba(255, 255, 255, 0.07);
  backdrop-filter: blur(10px);
  border: none;
  cursor: pointer;
  max-width: 280px;
  transition: background-color 0.2s ease, transform 0.15s ease;
  user-select: none;
}

[data-theme='light'] .semi-transparent-appbox {
  background-color: rgba(0, 0, 0, 0.05);
}

.semi-transparent-appbox:hover {
  background-color: rgba(255, 255, 255, 0.13);
  transform: translateY(-1px);
}

[data-theme='light'] .semi-transparent-appbox:hover {
  background-color: rgba(0, 0, 0, 0.09);
}

.appbox-img {
  width: 48px;
  height: 32px;
  border-radius: 5px;
  object-fit: cover;
  flex-shrink: 0;
}

.appbox-text-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: left;
  overflow: hidden;
}

.appbox-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.appbox-desc {
  font-size: 11px;
  color: var(--ev-c-text-2);
  line-height: 1.2;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.spinner-wrapper,
.abort-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
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

/* Text Fade Transition inside the button */
.text-fade-enter-active,
.text-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.text-fade-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.text-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.bottom-footer {
  position: fixed;
  bottom: 15px;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 11px;
  font-family: var(--font-body);
  z-index: 90;
  pointer-events: none;
}

.bottom-footer > * {
  pointer-events: auto;
}

.version-text {
  color: var(--ev-c-text-3);
  font-weight: 500;
  line-height: 1.2;
}

.dev-warning-btn {
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 600;
  color: #ef4444;
  letter-spacing: 0.5px;
  cursor: pointer;
  outline: none;
  transition: opacity 0.15s ease, text-decoration 0.15s ease;
  line-height: 1.2;
}

.dev-warning-btn:hover {
  text-decoration: underline;
  opacity: 0.85;
}
</style>
