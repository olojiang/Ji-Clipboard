<script setup lang="ts">
defineProps<{ msg: string }>()
</script>

<template>
  <div class="hello">
    <p class="message">{{ msg }}</p>
    <p class="subtitle">Welcome to Ji-Clipboard - A simple clipboard sharing app</p>
  </div>
</template>

<style scoped>
.hello {
  margin-top: 2rem;
}

.message {
  font-size: 1.5rem;
  color: #35495e;
  font-weight: 600;
}

.subtitle {
  font-size: 1rem;
  color: #666;
  margin-top: 0.5rem;
}
</style>
