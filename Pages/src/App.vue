<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import ClipboardPage from './components/ClipboardPage.vue'
import SharePage from './components/SharePage.vue'
import FetchPage from './components/FetchPage.vue'
import ProfilePage from './components/ProfilePage.vue'
import MySharesOverlay from './components/MySharesOverlay.vue'
import Toast from './components/Toast.vue'

// API 基础地址
const API_BASE = import.meta.env.VITE_API_URL || 'https://ji-clipboard-worker.olojiang.workers.dev'

// 页面基础 URL
const BASE_URL = `${window.location.origin}${window.location.pathname.replace(/\/$/, '')}`

// 当前页面标签
const currentTab = ref('clipboard')

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

// 登录状态加载中
const authLoading = ref(true)

// 我的分享弹窗
const showMyShares = ref(false)
const mySharesRef = ref<InstanceType<typeof MySharesOverlay> | null>(null)

// Toast 提示
const toastMessage = ref('')
const showToast = ref(false)

// 页面加载时获取用户信息
onMounted(async () => {
  // 检查 URL hash
  const hash = window.location.hash.replace('#', '')
  if (hash && ['clipboard', 'fetch', 'share', 'profile'].includes(hash)) {
    currentTab.value = hash
  }

  // 检查 URL 参数中的 session
  const urlParams = new URLSearchParams(window.location.search)
  const urlSession = urlParams.get('session')
  
  if (urlSession) {
    localStorage.setItem('session_id', urlSession)
    urlParams.delete('session')
    const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '') + window.location.hash
    window.history.replaceState({}, '', newUrl)
  }

  // 延迟获取用户信息
  setTimeout(async () => {
    await fetchUserInfo()
    authLoading.value = false
  }, 1000)
})

// 获取用户信息
async function fetchUserInfo() {
  try {
    const localSession = localStorage.getItem('session_id')
    let url = `${API_BASE}/api/me`
    if (localSession) {
      url += `?session=${localSession}`
    }

    const response = await fetch(url, {
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    user.value = data
  } catch (error) {
    console.error('获取用户信息失败:', error)
    user.value = { loggedIn: false }
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
    localStorage.removeItem('session_id')
  } catch (error) {
    console.error('登出失败:', error)
  }
}

// 切换标签页
function switchTab(tab: string) {
  currentTab.value = tab
  window.history.replaceState({}, '', `#${tab}`)
}

// 显示我的分享
function showMySharesDialog() {
  showMyShares.value = true
  setTimeout(() => {
    mySharesRef.value?.onOpen()
  }, 100)
}

// 显示 Toast
function showToastMessage(message: string) {
  toastMessage.value = message
  showToast.value = true
}

// 隐藏 Toast
function hideToast() {
  showToast.value = false
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
      <!-- 剪贴板页面 -->
      <ClipboardPage
        v-if="currentTab === 'clipboard'"
        :user="user"
        :auth-loading="authLoading"
        @show-toast="showToastMessage"
      />

      <!-- 获取页面 -->
      <FetchPage
        v-if="currentTab === 'fetch'"
        @show-toast="showToastMessage"
      />

      <!-- 分享页面 -->
      <SharePage
        v-if="currentTab === 'share'"
        :user="user"
        :auth-loading="authLoading"
        :base-url="BASE_URL"
        @show-toast="showToastMessage"
      />

      <!-- 个人中心页面 -->
      <ProfilePage
        v-if="currentTab === 'profile'"
        :user="user"
        :auth-loading="authLoading"
        @login="loginWithGitHub"
        @logout="logout"
        @show-my-shares="showMySharesDialog"
      />
    </main>

    <!-- 我的分享弹窗 -->
    <MySharesOverlay
      ref="mySharesRef"
      :show="showMyShares"
      :base-url="BASE_URL"
      @close="showMyShares = false"
    />

    <!-- Toast 提示 -->
    <Toast
      :message="toastMessage"
      :show="showToast"
      @hide="hideToast"
    />

    <!-- 底部导航栏 -->
    <mdui-navigation-bar 
      class="bottom-nav"
      :value="currentTab"
      @change="(e: any) => switchTab(e.target.value)"
    >
      <mdui-navigation-bar-item icon="content_paste" value="clipboard">剪贴板</mdui-navigation-bar-item>
      <mdui-navigation-bar-item icon="download" value="fetch">获取</mdui-navigation-bar-item>
      <mdui-navigation-bar-item icon="share" value="share">分享</mdui-navigation-bar-item>
      <mdui-navigation-bar-item icon="person" value="profile">我的</mdui-navigation-bar-item>
    </mdui-navigation-bar>
  </div>
</template>

<style>
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
  max-width: 900px;
  margin: 0 auto;
}

.section {
  margin-bottom: 16px;
}

.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  -webkit-tap-highlight-color: transparent;
}

.bottom-nav::part(item) {
  -webkit-tap-highlight-color: transparent;
}

.bottom-nav mdui-navigation-bar-item {
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
</style>