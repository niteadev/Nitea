<script setup lang="ts">
import { ref, watch } from 'vue'
import { AlertCircle, AlertTriangle, Info, CheckCircle2 } from '@lucide/vue'

export interface ToastItem {
  id: string
  type: 'error' | 'warning' | 'info' | 'success'
  title: string
  message?: string | null
  effect?: 'confetti' | null
}

const props = defineProps<{
  toasts: ToastItem[]
}>()

const confettiCanvas = ref<HTMLCanvasElement | null>(null)

const triggerConfetti = (): void => {
  const canvas = confettiCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#f43f5e']
  const particleCount = 75
  const particles: Array<{
    x: number
    y: number
    vx: number
    vy: number
    size: number
    color: string
    rotation: number
    rotationSpeed: number
    opacity: number
  }> = []

  const originX = window.innerWidth / 2
  const originY = window.innerHeight - 70

  for (let i = 0; i < particleCount; i++) {
    const spread = (Math.random() - 0.5) * 1.4
    const speed = Math.random() * 12 + 7
    particles.push({
      x: originX,
      y: originY,
      vx: Math.sin(spread) * speed,
      vy: -Math.cos(spread) * speed,
      size: Math.random() * 7 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
      opacity: 1
    })
  }

  const startTime = Date.now()

  const render = (): void => {
    const elapsed = Date.now() - startTime
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    let activeCount = 0
    particles.forEach((p) => {
      if (p.opacity <= 0) return
      activeCount++
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.38 // Gravity
      p.vx *= 0.98 // Air resistance
      p.rotation += p.rotationSpeed
      if (elapsed > 1400) {
        p.opacity -= 0.025
      }

      ctx.save()
      ctx.globalAlpha = Math.max(0, p.opacity)
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rotation)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
      ctx.restore()
    })

    if (activeCount > 0 && elapsed < 2800) {
      requestAnimationFrame(render)
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }

  render()
}

watch(
  () => props.toasts,
  (newToasts) => {
    const latest = newToasts[newToasts.length - 1]
    if (latest && latest.type === 'success' && latest.effect === 'confetti') {
      triggerConfetti()
    }
  },
  { deep: true }
)
</script>

<template>
  <!-- Fullscreen Canvas overlay for effects like Confetti -->
  <canvas ref="confettiCanvas" class="confetti-canvas"></canvas>

  <!-- Bottom Centered Toast Container -->
  <div class="toast-container">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="toast-card"
        :class="toast.type"
      >
        <!-- Only icon is colored -->
        <div class="toast-icon-wrap">
          <AlertCircle v-if="toast.type === 'error'" :size="18" class="icon-error" />
          <AlertTriangle v-else-if="toast.type === 'warning'" :size="18" class="icon-warning" />
          <Info v-else-if="toast.type === 'info'" :size="18" class="icon-info" />
          <CheckCircle2 v-else-if="toast.type === 'success'" :size="18" class="icon-success" />
        </div>

        <div class="toast-content">
          <div class="toast-title font-header">{{ toast.title }}</div>
          <div v-if="toast.message && toast.message.trim()" class="toast-desc">
            {{ toast.message }}
          </div>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.confetti-canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 99998;
}

/* Bottom Centered Position */
.toast-container {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 99999;
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
  gap: 10px;
  pointer-events: none;
  max-width: 400px;
  width: auto;
}

.toast-card {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-radius: 8px;
  background-color: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  border: none;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
  color: var(--color-text);
  font-family: var(--font-body);
  user-select: none;
  white-space: nowrap;
}

[data-theme='light'] .toast-card {
  background-color: rgba(0, 0, 0, 0.06);
  box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.1);
}

.toast-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* Only Icon is Colored */
.icon-error {
  color: #ef4444;
}

.icon-warning {
  color: #f59e0b;
}

.icon-info {
  color: #3b82f6;
}

.icon-success {
  color: #10b981;
}

.toast-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  text-align: left;
}

.toast-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.3;
}

.toast-desc {
  font-size: 12px;
  color: var(--ev-c-text-2);
  line-height: 1.35;
  white-space: normal;
}

/* Toast Animations for Bottom Centered */
.toast-enter-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-leave-active {
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  position: absolute;
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}

.toast-move {
  transition: transform 0.3s ease;
}
</style>
