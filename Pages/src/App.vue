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
    icon: 'description',
    expired: false
  },
  {
    id: 2,
    type: 'link',
    title: 'https://github.com/desi...',
    subtitle: 'Fetched yesterday • Code: 11094',
    icon: 'link',
    expired: false
  },
  {
    id: 3,
    type: 'image',
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
    <!-- 顶部导航栏 -->
    <mdui-top-app-bar class="app-bar">
      <mdui-button-icon icon="cloud" slot="navigation"></mdui-button-icon>
      <mdui-top-app-bar-title>Cloud Clipboard</mdui-top-app-bar-title>
      <mdui-button-icon icon="account_circle" slot="action"></mdui-button-icon>
    </mdui-top-app-bar>

    <!-- 主内容区 -->
    <mdui-layout-main class="main-content">
      
      <!-- Fetch 区域 -->
      <div class="section">
        <mdui-card class="fetch-card">
          <h2 class="title">Fetch your clipboard</h2>
          <p class="subtitle">Enter the 5-digit code to extract your shared data instantly.</p>
          
          <mdui-text-field 
            v-model="code"
            label="5-digit code"
            maxlength="5"
            class="code-input"
          ></mdui-text-field>
          
          <mdui-button 
            variant="filled"
            class="fetch-btn"
            @click="handleFetch"
          >
            <mdui-icon slot="icon" name="arrow_forward"></mdui-icon>
            Fetch
          </mdui-button>
        </mdui-card>
      </div>

      <!-- Share 区域 -->
      <div class="section">
        <mdui-card 
          class="share-card"
          clickable
          @click="handleShare"
        >
          <div class="share-content">
            <mdui-avatar class="share-avatar">
              <mdui-icon name="content_copy"></mdui-icon>
            </mdui-avatar>
            <h3 class="share-title">Share My Clipboard</h3>
            <p class="share-desc">Generate a unique code for your text or files</p>
          </div>
        </mdui-card>
      </div>

      <!-- Recent Clips 区域 -->
      <div class="section">
        <mdui-card class="recent-card">
          <div class="recent-header">
            <span class="recent-title">RECENT CLIPS</span>
            <mdui-button 
              variant="text"
              @click="clearAll"
            >
              Clear all
            </mdui-button>
          </div>
          
          <mdui-list class="clips-list">
            <mdui-list-item
              v-for="clip in recentClips"
              :key="clip.id"
              :headline="clip.title"
              :description="clip.subtitle"
              :disabled="clip.expired"
            >
              <mdui-icon 
                slot="icon"
                :name="clip.icon"
              ></mdui-icon>
              <mdui-icon 
                slot="end-icon"
                name="more_vert"
              ></mdui-icon>
            </mdui-list-item>
          </mdui-list>
          
          <div v-if="recentClips.length === 0" class="empty-state">
            <mdui-icon name="inbox"></mdui-icon>
            <p>No recent clips</p>
          </div>
        </mdui-card>
      </div>
    </mdui-layout-main>

    <!-- 底部导航栏 -->
    <mdui-navigation-bar 
      class="bottom-nav"
      value="fetch"
    >
      <mdui-navigation-bar-item icon="home" value="fetch">
        获取
      </mdui-navigation-bar-item>
      
      <mdui-fab 
        class="center-fab"
        icon="add"
        @click="handleShare"
      ></mdui-fab>
      
      <mdui-navigation-bar-item icon="person" value="profile">
        我的
      </mdui-navigation-bar-item>
    </mdui-navigation-bar>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  background: var(--mdui-color-surface-container-low);
  padding-bottom: 80px;
}

.app-bar {
  position: sticky;
  top: 0;
  z-index: 100;
}

.main-content {
  padding: 16px;
  max-width: 600px;
  margin: 0 auto;
}

.section {
  margin-bottom: 16px;
}

/* Fetch Card */
.fetch-card {
  padding: 24px;
  text-align: center;
}

.title {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--mdui-color-on-surface);
}

.subtitle {
  margin: 0 0 24px 0;
  font-size: 14px;
  color: var(--mdui-color-on-surface-variant);
}

.code-input {
  width: 100%;
  margin-bottom: 16px;
}

.fetch-btn {
  width: 100%;
  --mdui-button-height: 48px;
}

/* Share Card */
.share-card {
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.share-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--mdui-elevation-level3);
}

.share-content {
  padding: 32px 24px;
  text-align: center;
}

.share-avatar {
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  font-size: 28px;
  background: var(--mdui-color-primary-container);
  color: var(--mdui-color-on-primary-container);
}

.share-title {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--mdui-color-on-surface);
}

.share-desc {
  margin: 0;
  font-size: 14px;
  color: var(--mdui-color-on-surface-variant);
}

/* Recent Card */
.recent-card {
  padding: 16px;
}

.recent-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding: 0 8px;
}

.recent-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--mdui-color-on-surface-variant);
  letter-spacing: 1px;
}

.clips-list {
  padding: 0;
}

.empty-state {
  text-align: center;
  padding: 32px;
  color: var(--mdui-color-on-surface-variant);
}

.empty-state mdui-icon {
  font-size: 48px;
  margin-bottom: 8px;
  opacity: 0.5;
}

/* Bottom Navigation */
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
}

.center-fab {
  position: absolute;
  top: -28px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
}
</style>
