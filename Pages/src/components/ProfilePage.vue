<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  user: { 
    loggedIn: boolean
    user?: {
      id: number
      login: string
      name: string
      avatar: string
      email: string
    }
  }
  authLoading: boolean
}>()

const emit = defineEmits(['login', 'logout', 'showMyShares', 'showStorage'])

// API 基础地址
const API_BASE = import.meta.env.VITE_API_URL || 'https://ji-clipboard-worker.olojiang.workers.dev'
</script>

<template>
  <div class="section">
    <!-- 加载中状态 -->
    <mdui-card v-if="authLoading" class="profile-card">
      <div class="loading-state">
        <div class="spinner"></div>
        <p>正在检查登录状态...</p>
      </div>
    </mdui-card>

    <!-- 未登录状态 -->
    <mdui-card v-else-if="!user.loggedIn" class="profile-card">
      <div class="profile-header">
        <div class="avatar-placeholder">
          <mdui-icon name="person" style="font-size: 48px;"></mdui-icon>
        </div>
        <h2 class="profile-title">未登录</h2>
        <p class="profile-subtitle">登录后可同步剪贴板历史</p>
      </div>
      
      <mdui-button 
        variant="filled"
        class="github-login-btn"
        @click="$emit('login')"
      >
        <svg class="github-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
        </svg>
        使用 GitHub 登录
      </mdui-button>
    </mdui-card>

    <!-- 已登录状态 -->
    <mdui-card v-else class="profile-card">
      <div class="profile-header">
        <img 
          :src="user.user?.avatar" 
          :alt="user.user?.login"
          class="avatar-image"
        >
        <h2 class="profile-title">{{ user.user?.name || user.user?.login }}</h2>
        <p class="profile-subtitle">@{{ user.user?.login }}</p>
      </div>
      
      <mdui-list>
        <mdui-list-item icon="storage" headline="存储管理" @click="$emit('showStorage')"></mdui-list-item>
      </mdui-list>
      
      <mdui-button 
        variant="outlined"
        class="logout-btn"
        @click="$emit('logout')"
      >
        退出登录
      </mdui-button>
    </mdui-card>
  </div>
</template>

<style scoped>
.profile-card {
  padding: 16px;
  width: 100%;
  box-sizing: border-box;
}

.loading-state {
  text-align: center;
  padding: 24px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--mdui-color-surface-container-highest);
  border-top-color: var(--mdui-color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.profile-header {
  text-align: center;
  margin-bottom: 24px;
}

.avatar-placeholder {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: var(--mdui-color-surface-container-highest);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  color: var(--mdui-color-on-surface-variant);
}

.avatar-image {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  margin: 0 auto 16px;
  display: block;
  object-fit: cover;
}

.profile-title {
  margin: 0 0 4px 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--mdui-color-on-surface);
}

.profile-subtitle {
  margin: 0;
  font-size: 14px;
  color: var(--mdui-color-on-surface-variant);
}

.github-login-btn {
  width: 100%;
  --mdui-button-height: 48px;
  gap: 8px;
}

.github-icon {
  width: 20px;
  height: 20px;
}

.logout-btn {
  width: 100%;
  margin-top: 16px;
  --mdui-button-height: 48px;
}
</style>