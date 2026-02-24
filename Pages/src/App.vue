<script setup lang="ts">
import { ref } from 'vue'

// 写死的数据
const code = ref('')
const recentClips = ref([
  {
    id: 1,
    type: 'text',
    title: 'Project requirements.txt',
    subtitle: 'Fetched 2 hours ago • Code: 48291',
    icon: '📄',
    expired: false
  },
  {
    id: 2,
    type: 'link',
    title: 'https://github.com/desi...',
    subtitle: 'Fetched yesterday • Code: 11094',
    icon: '🔗',
    expired: false
  },
  {
    id: 3,
    type: 'image',
    title: 'screenshot_2023.png',
    subtitle: 'Expired 2 days ago',
    icon: '🖼️',
    expired: true
  }
])

const activeTab = ref('fetch')

function handleFetch() {
  alert(`Fetching code: ${code.value}`)
}

function handleShare() {
  alert('Generate share code!')
}

function clearAll() {
  recentClips.value = []
}
</script>

<template>
  <div class="app">
    <!-- Header -->
    <header class="header">
      <div class="logo">
        <span class="logo-icon">☁️</span>
        <span class="logo-text">Cloud Clipboard</span>
      </div>
      <div class="avatar">👤</div>
    </header>

    <!-- Main Content -->
    <main class="main">
      <!-- Fetch Section -->
      <section class="fetch-section">
        <h1 class="title">Fetch your clipboard</h1>
        <p class="subtitle">Enter the 5-digit code to extract your shared data instantly.</p>
        
        <div class="input-group">
          <input 
            v-model="code" 
            type="text" 
            placeholder="5-digit code"
            maxlength="5"
            class="code-input"
          />
          <button class="fetch-btn" @click="handleFetch">
            Fetch →
          </button>
        </div>
      </section>

      <!-- Share Section -->
      <section class="share-section">
        <div class="share-card" @click="handleShare">
          <div class="share-icon">📋</div>
          <h2 class="share-title">Share My Clipboard</h2>
          <p class="share-desc">Generate a unique code for your text or files</p>
        </div>
      </section>

      <!-- Recent Clips -->
      <section class="recent-section">
        <div class="recent-header">
          <h3 class="recent-title">RECENT CLIPS</h3>
          <button class="clear-btn" @click="clearAll">Clear all</button>
        </div>
        
        <div class="clips-list">
          <div 
            v-for="clip in recentClips" 
            :key="clip.id"
            class="clip-item"
            :class="{ expired: clip.expired }"
          >
            <div class="clip-icon">{{ clip.icon }}</div>
            <div class="clip-info">
              <div class="clip-title">{{ clip.title }}</div>
              <div class="clip-subtitle">{{ clip.subtitle }}</div>
            </div>
            <div class="clip-menu">⋮</div>
          </div>
        </div>
      </section>
    </main>

    <!-- Bottom Navigation -->
    <nav class="bottom-nav">
      <div 
        class="nav-item" 
        :class="{ active: activeTab === 'fetch' }"
        @click="activeTab = 'fetch'"
      >
        <span class="nav-icon">🏠</span>
        <span class="nav-text">获取</span>
      </div>
      <div 
        class="nav-item"
        @click="handleShare"
      >
        <span class="nav-icon nav-plus">+</span>
      </div>
      <div 
        class="nav-item" 
        :class="{ active: activeTab === 'profile' }"
        @click="activeTab = 'profile'"
      >
        <span class="nav-icon">👤</span>
        <span class="nav-text">我的</span>
      </div>
    </nav>
  </div>
</template>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.app {
  min-height: 100vh;
  background: #f5f7fa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  padding-bottom: 80px;
}

/* Header */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: white;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo-icon {
  font-size: 24px;
}

.logo-text {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a2e;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #e8ecf1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

/* Main */
.main {
  padding: 20px;
}

/* Fetch Section */
.fetch-section {
  text-align: center;
  margin-bottom: 32px;
}

.title {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a2e;
  margin-bottom: 12px;
}

.subtitle {
  font-size: 14px;
  color: #666;
  margin-bottom: 24px;
  line-height: 1.5;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.code-input {
  width: 100%;
  padding: 16px 20px;
  font-size: 18px;
  text-align: center;
  letter-spacing: 8px;
  border: 2px solid #e0e4e8;
  border-radius: 12px;
  background: white;
  outline: none;
  transition: border-color 0.2s;
}

.code-input:focus {
  border-color: #007bff;
}

.code-input::placeholder {
  color: #007bff;
  letter-spacing: 2px;
  font-size: 14px;
}

.fetch-btn {
  width: 100%;
  padding: 16px;
  font-size: 16px;
  font-weight: 600;
  color: white;
  background: #007bff;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.fetch-btn:hover {
  background: #0056b3;
}

/* Share Section */
.share-section {
  margin-bottom: 32px;
}

.share-card {
  background: white;
  border-radius: 16px;
  padding: 32px 24px;
  text-align: center;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.share-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.share-icon {
  width: 64px;
  height: 64px;
  background: #f0f7ff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  margin: 0 auto 16px;
}

.share-title {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 8px;
}

.share-desc {
  font-size: 14px;
  color: #888;
}

/* Recent Section */
.recent-section {
  background: white;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.recent-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.recent-title {
  font-size: 12px;
  font-weight: 600;
  color: #888;
  letter-spacing: 1px;
}

.clear-btn {
  font-size: 14px;
  color: #007bff;
  background: none;
  border: none;
  cursor: pointer;
}

.clips-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.clip-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 12px;
}

.clip-item.expired {
  opacity: 0.6;
}

.clip-icon {
  width: 44px;
  height: 44px;
  background: #e8f4fd;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.clip-info {
  flex: 1;
  min-width: 0;
}

.clip-title {
  font-size: 15px;
  font-weight: 500;
  color: #1a1a2e;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.clip-subtitle {
  font-size: 12px;
  color: #888;
}

.clip-menu {
  font-size: 20px;
  color: #888;
  cursor: pointer;
  padding: 4px;
}

/* Bottom Navigation */
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-around;
  align-items: center;
  background: white;
  padding: 8px 0;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 24px;
  cursor: pointer;
  color: #888;
  transition: color 0.2s;
}

.nav-item.active {
  color: #007bff;
}

.nav-icon {
  font-size: 20px;
}

.nav-text {
  font-size: 12px;
}

.nav-plus {
  width: 48px;
  height: 48px;
  background: #1a1a2e;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  margin-top: -20px;
}
</style>
