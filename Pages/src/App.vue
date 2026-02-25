<script setup lang="ts">
import { ref, onMounted } from 'vue'

// API 基础地址
const API_BASE = import.meta.env.VITE_API_URL || 'https://你的worker地址.workers.dev'

// 当前页面标签
const currentTab = ref('fetch')

// 用户信息
const user = ref<{
  loggedIn: boolean
  user?: {
    id: number
    login: string
    name: string
    avatar: string
    email: string
  }
}>({ loggedIn: false })

// 写死的数据
const code = ref('')
const recentClips = ref([
  {
    id: 1,
    type: 'text',
    title: 'Project requirements.txt',
    subtitle: '2小时前获取 • 提取码: 48291',
    icon: 'description',
    expired: false
  },
  {
    id: 2,
    type: 'link',
    title: 'https://github.com/desi...',
    subtitle: '昨天获取 • 提取码: 11094',
    icon: 'link',
    expired: false
  },
  {
    id: 3,
    type: 'image',
    title: 'screenshot_2023.png',
    subtitle: '2天前过期',
    icon: 'image',
    expired: true
  }
])

// 页面加载时获取用户信息
onMounted(async () => {
  await fetchUserInfo()
})

// 获取用户信息
async function fetchUserInfo() {
  try {
    const response = await fetch(`${API_BASE}/api/me`, {
      credentials: 'include'
    })
    const data = await response.json()
    user.value = data
  } catch (error) {
    console.error('获取用户信息失败:', error)
  }
}

// GitHub 登录
function loginWithGitHub() {
  window.location.href = `${API_BASE}/auth/github`
}

// 登出
async function logout() {
  try {
    await fetch(`${API_BASE}/api/logout`, {
      method: 'POST',
      credentials: 'include'
    })
    user.value = { loggedIn: false }
  } catch (error) {
    console.error('登出失败:', error)
  }
}

function handleFetch() {
  alert(`正在获取: ${code.value || '空'}`)
}

function handleShare() {
  alert('生成分享码!')
}

function clearAll() {
  recentClips.value = []
}

function switchTab(tab: string) {
  currentTab.value = tab
}
</script>

<template>
  <div class="app">
    <!-- 顶部导航栏 -->
    <mdui-top-app-bar class="app-bar">
      <mdui-button-icon icon="cloud"></mdui-button-icon>
      <mdui-top-app-bar-title>云剪贴板</mdui-top-app-bar-title>
      <mdui-button-icon icon="account_circle"></mdui-button-icon>
    </mdui-top-app-bar>

    <!-- 主内容区 -->
    <main class="main-content">
      
      <!-- 获取页面 -->
      <template v-if="currentTab === 'fetch'">
        <!-- 提取区域 -->
        <div class="section">
          <mdui-card class="fetch-card">
            <h2 class="title">提取剪贴板</h2>
            <p class="subtitle">输入5位提取码，立即获取分享的内容</p>
            
            <mdui-text-field 
              v-model="code"
              label="5位提取码"
              maxlength="5"
              class="code-input"
            ></mdui-text-field>
            
            <mdui-button 
              variant="filled"
              class="fetch-btn"
              @click="handleFetch"
            >
              <mdui-icon slot="icon" name="arrow_forward"></mdui-icon>
              提取
            </mdui-button>
          </mdui-card>
        </div>

        <!-- 最近剪贴板区域 -->
        <div class="section">
          <mdui-card class="recent-card">
            <div class="recent-header">
              <span class="recent-title">最近剪贴板</span>
              <mdui-button 
                variant="text"
                @click="clearAll"
              >
                清空全部
              </mdui-button>
            </div>
            
            <mdui-list class="clips-list">
              <mdui-list-item
                v-for="clip in recentClips"
                :key="clip.id"
                :headline="clip.title"
                :description="clip.subtitle"
                :disabled="clip.expired"
                :icon="clip.icon"
                end-icon="more_vert"
              >
              </mdui-list-item>
            </mdui-list>
            
            <div v-if="recentClips.length === 0" class="empty-state">
              <mdui-icon name="inbox"></mdui-icon>
              <p>暂无最近剪贴板</p>
            </div>
          </mdui-card>
        </div>
      </template>

      <!-- 分享页面 -->
      <template v-if="currentTab === 'share'">
        <div class="section">
          <mdui-card class="placeholder-card">
            <mdui-icon name="share" style="font-size: 48px; opacity: 0.5;"></mdui-icon>
            <p>分享功能开发中...</p>
          </mdui-card>
        </div>
      </template>

      <!-- 我的页面（个人中心）-->
      <template v-if="currentTab === 'profile'">
        <div class="section">
          <!-- 未登录状态 -->
          <mdui-card v-if="!user.loggedIn" class="profile-card">
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
              @click="loginWithGitHub"
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
              <mdui-list-item icon="history" headline="我的剪贴板"></mdui-list-item>
              <mdui-list-item icon="settings" headline="设置"></mdui-list-item>
              <mdui-list-item icon="help" headline="帮助"></mdui-list-item>
            </mdui-list>
            
            <mdui-button 
              variant="outlined"
              class="logout-btn"
              @click="logout"
            >
              退出登录
            </mdui-button>
          </mdui-card>
        </div>
      </template>
    </main>

    <!-- 底部导航栏 -->
    <mdui-navigation-bar 
      class="bottom-nav"
      :value="currentTab"
      @change="(e: any) => switchTab(e.target.value)"
    >
      <mdui-navigation-bar-item icon="download" value="fetch">
        获取
      </mdui-navigation-bar-item>
      
      <mdui-navigation-bar-item icon="share" value="share">
        分享
      </mdui-navigation-bar-item>
      
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

/* Placeholder Card */
.placeholder-card {
  padding: 64px 24px;
  text-align: center;
  color: var(--mdui-color-on-surface-variant);
}

.placeholder-card p {
  margin-top: 16px;
  font-size: 16px;
}

/* Profile Card */
.profile-card {
  padding: 32px 24px;
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

/* Bottom Navigation */
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
}
</style>
