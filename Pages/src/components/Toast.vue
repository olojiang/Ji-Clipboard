<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  message: string
  show: boolean
  showUndo?: boolean
}>()

const emit = defineEmits(['hide', 'undo'])

let timeoutId: number | null = null

watch(() => props.show, (newShow) => {
  if (newShow) {
    // 清除之前的定时器
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    // 设置新的定时器
    timeoutId = window.setTimeout(() => {
      emit('hide')
    }, 3000)
  }
})

function handleUndo() {
  if (timeoutId) {
    clearTimeout(timeoutId)
    timeoutId = null
  }
  emit('undo')
}
</script>

<template>
  <transition name="fade">
    <div v-if="show" class="toast">
      <span class="toast-message">{{ message }}</span>
      <button v-if="showUndo" class="undo-btn" @click="handleUndo">撤回</button>
    </div>
  </transition>
</template>

<style scoped>
.toast {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 12px 16px;
  border-radius: 24px;
  font-size: 14px;
  z-index: 10000;
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 90%;
  white-space: nowrap;
}

.toast-message {
  flex: 1;
}

.undo-btn {
  background: transparent;
  border: none;
  color: #4CAF50;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.undo-btn:hover {
  background: rgba(76, 175, 80, 0.2);
}

.undo-btn:active {
  background: rgba(76, 175, 80, 0.3);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}

.fade-enter-to,
.fade-leave-from {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
</style>
