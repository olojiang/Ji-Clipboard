<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  message: string
  show: boolean
}>()

const emit = defineEmits(['hide'])

watch(() => props.show, (newShow) => {
  if (newShow) {
    setTimeout(() => {
      emit('hide')
    }, 2000)
  }
})
</script>

<template>
  <transition name="fade">
    <div v-if="show" class="toast">{{ message }}</div>
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
  padding: 12px 24px;
  border-radius: 24px;
  font-size: 14px;
  z-index: 10000;
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