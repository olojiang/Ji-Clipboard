<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface TimeData {
  timestamp: string
  unixTime: number
  formatted: string
  timezone: string
}

const timeData = ref<TimeData | null>(null)
const loading = ref(false)
const error = ref('')

// Worker API 地址 - 部署后需要更新为实际地址
const WORKER_URL = 'https://ji-clipboard-worker.olojiang.workers.dev'

async function fetchTime() {
  loading.value = true
  error.value = ''
  
  try {
    const response = await fetch(`${WORKER_URL}/api/time`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    timeData.value = await response.json()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to fetch time'
    console.error('Failed to fetch time:', e)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchTime()
})
</script>

<template>
  <div class="container">
    <h1>Ji-Clipboard</h1>
    
    <div class="time-section">
      <h2>🕐 Server Time</h2>
      
      <div v-if="loading" class="loading">Loading...⏳</div>
      
      <div v-else-if="error" class="error">
        Error: {{ error }}
        <button @click="fetchTime" class="retry-btn">Retry</button>
      </div>
      
      <div v-else-if="timeData" class="time-display">
        <div class="time-card">
          <div class="time-main">{{ timeData.formatted }}</div>
          <div class="time-details">
            <p><strong>Timezone:</strong> {{ timeData.timezone }}</p>
            <p><strong>ISO Format:</strong> {{ timeData.timestamp }}</p>
            <p><strong>Unix Timestamp:</strong> {{ timeData.unixTime }}</p>
          </div>
        </div>
        
        <button @click="fetchTime" class="refresh-btn">🔄 Refresh</button>
      </div>
      
      <div v-else class="no-data">No time data available</div>
    </div>
  </div>
</template>

<style scoped>
.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
  font-family: system-ui, -apple-system, sans-serif;
}

h1 {
  color: #42b883;
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

h2 {
  color: #35495e;
  font-size: 1.5rem;
  margin-bottom: 1.5rem;
}

.time-section {
  margin-top: 2rem;
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.loading {
  color: #666;
  font-size: 1.2rem;
  padding: 2rem;
}

.error {
  color: #e74c3c;
  padding: 1rem;
  background: #fdf2f2;
  border-radius: 8px;
  margin: 1rem 0;
}

.time-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.time-card {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 500px;
}

.time-main {
  font-size: 2rem;
  font-weight: bold;
  color: #42b883;
  margin-bottom: 1rem;
}

.time-details {
  text-align: left;
  color: #666;
  font-size: 0.9rem;
}

.time-details p {
  margin: 0.5rem 0;
}

.refresh-btn, .retry-btn {
  background: #42b883;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
}

.refresh-btn:hover, .retry-btn:hover {
  background: #369870;
}

.no-data {
  color: #999;
  padding: 2rem;
}
</style>
