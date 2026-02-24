<script setup lang="ts">
import { ref } from 'vue'
import 'mdui/mdui.css'

const code = ref('')
const recentClips = ref([
  {
    id: 1,
    title: 'Project requirements.txt',
    subtitle: 'Fetched 2 hours ago • Code: 48291',
    icon: 'description',
    expired: false
  },
  {
    id: 2,
    title: 'https://github.com/desi...',
    subtitle: 'Fetched yesterday • Code: 11094',
    icon: 'link',
    expired: false
  },
  {
    id: 3,
    title: 'screenshot_2023.png',
    subtitle: 'Expired 2 days ago',
    icon: 'image',
    expired: true
  }
])

function handleFetch() {
  alert(`Fetching code: ${code.value || 'empty'}`)
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
    <header class="header">
      <div class="logo">
        <span class="material-icons" style="color: #007bff;">cloud</span>
        <span>Cloud Clipboard</span>
      </div>
      <span class="material-icons" style="font-size: 28px; color: #666;">account_circle</span>
    </header>

    <main class="main">
      <div class="section">
        <div class="card">
          <h2 class="title">Fetch your clipboard</h2>
          <p class="subtitle">Enter the 5-digit code to extract your shared data instantly.</p>
          
          <input 
            v-model="code"
            type="text"
            placeholder="5-digit code"
            maxlength="5"
            class="input-field"
          >
          
          <button class="btn" @click="handleFetch">
            <span class="material-icons">arrow_forward</span>
            Fetch
          </button>
        </div>
      </div>

      <div class="section">
        <div class="card share-card" @click="handleShare">
          <div class="share-icon">
            <span class="material-icons">content_copy</span>
          </div>
          <h3 class="share-title">Share My Clipboard</h3>
          <p class="share-desc">Generate a unique code for your text or files</p>
        </div>
      </div>

      <div class="section">
        <div class="card">
          <div class="recent-header">
            <span class="recent-title">RECENT CLIPS</span>
            <button class="clear-btn" @click="clearAll">Clear all</button>
          </div>
          
          <div v-if="recentClips.length > 0" class="clips-list">
            <div 
              v-for="clip in recentClips"
              :key="clip.id"
              class="clip-item"
              :class="{ expired: clip.expired }"
            >
              <div class="clip-icon">
                <span class="material-icons">{{ clip.icon }}</span>
              </div>
              <div class="clip-info">
                <div class="clip-title">{{ clip.title }}</div>
                <div class="clip-subtitle">{{ clip.subtitle }}</div>
              </div>
              <div class="clip-menu">
                <span class="material-icons">more_vert</span>
              </div>
            </div>
          </div>
          
          <div v-else class="empty-state">
            <span class="material-icons">inbox</span>
            <p>No recent clips</p>
          </div>
        </div>
      </div>
    </main>

    <nav class="bottom-nav">
      <div class="nav-item active">
        <span class="material-icons">home</span>
        <span class="nav-text">获取</span>
      </div>
      
      <div class="nav-fab" @click="handleShare">
        <span class="material-icons">add</span>
      </div>
      
      <div class="nav-item">
        <span class="material-icons">person</span>
        <span class="nav-text">我的</span>
      </div>
    </nav>
  </div>
</template>

<style>
@import 'mdui/mdui.css';

.app {
  min-height: 100vh;
  background: #f5f7fa;
  padding-bottom: 80px;
}

.header {
  background: white;
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
  color: #1a1a2e;
}

.main {
  padding: 16px;
  max-width: 600px;
  margin: 0 auto;
}

.section {
  margin-bottom: 16px;
}

.card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.title {
  font-size: 24px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 8px;
  text-align: center;
}

.subtitle {
  font-size: 14px;
  color: #666;
  margin-bottom: 24px;
  text-align: center;
}

.input-field {
  width: 100%;
  padding: 16px;
  font-size: 18px;
  text-align: center;
  letter-spacing: 8px;
  border: 2px solid #e0e4e8;
  border-radius: 12px;
  margin-bottom: 16px;
  outline: none;
}

.input-field:focus {
  border-color: #007bff;
}

.btn {
  width: 100%;
  padding: 16px;
  font-size: 16px;
  font-weight: 600;
  color: white;
  background: #007bff;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.share-card {
  text-align: center;
  cursor: pointer;
}

.share-icon {
  width: 64px;
  height: 64px;
  background: #e8f4fd;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
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

.clip-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 12px;
  margin-bottom: 8px;
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
}

.clip-title {
  font-size: 15px;
  font-weight: 500;
  color: #1a1a2e;
  margin-bottom: 4px;
}

.clip-subtitle {
  font-size: 12px;
  color: #888;
}

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
  box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 24px;
  cursor: pointer;
  color: #888;
}

.nav-item.active {
  color: #007bff;
}

.nav-fab {
  width: 56px;
  height: 56px;
  background: #1a1a2e;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: -20px;
  cursor: pointer;
}

.empty-state {
  text-align: center;
  padding: 32px;
  color: #888;
}
</style>
