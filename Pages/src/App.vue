<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import ClipboardPage from './components/ClipboardPage.vue'
import FetchPage from './components/FetchPage.vue'
import MySharesPage from './components/MySharesPage.vue'
import StoragePage from './components/StoragePage.vue'
import ProfilePage from './components/ProfilePage.vue'
import AdminPage from './components/AdminPage.vue'
import Toast from './components/Toast.vue'

// API 基础地址
const API_BASE = import.meta.env.VITE_API_URL || 'https://ji-clipboard-worker.olojiang.workers.dev'

// 页面基础 URL
const BASE_URL = `${window.location.origin}${window.location.pathname.replace(/\/$/, '')}`

// 管理员用户名列表
const ADMIN_USERS = ['PANDAJSR', 'olojiang']

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

// 计算是否为管理员
const isAdmin = computed(() => {
  return user.value.user?.login && ADMIN_USERS.includes(user.value.user.login)
})

// 登录状态加载中
const authLoading = ref(true)

// Toast 提示
const toastMessage = ref('')
const showToast = ref(false)
const showUndoButton = ref(false)
const clipboardPageRef = ref<InstanceType<typeof ClipboardPage> | null>(null)

// 页面加载时获取用户信息
onMounted(async () => {
  // 检查 URL 参数中的 share（分享链接）
  const urlParams = new URLSearchParams(window.location.search)
  const shareCode = urlParams.get('share')
  
  if (shareCode) {
    console.log('[App] 检测到分享码:', shareCode)
    // 有分享码，直接跳转到获取页面并传递分享码
    currentTab.value = 'fetch'
    // 将分享码存储到 localStorage，供 FetchPage 使用
    localStorage.setItem('pending_share_code', shareCode)
    console.log('[App] 已存储分享码到 localStorage')
  } else {
    // 检查 URL hash
    const hash = window.location.hash.replace('#', '')
    if (hash && ['clipboard', 'fetch', 'my-shares', 'profile'].includes(hash)) {
      currentTab.value = hash
    }
  }

  // 检查 URL 参数中的 session
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

// 显示 Toast
function showToastMessage(message: string, showUndo: boolean = false) {
  toastMessage.value = message
  showUndoButton.value = showUndo
  showToast.value = true
}

// 隐藏 Toast
function hideToast() {
  showToast.value = false
  showUndoButton.value = false
}

// 处理撤回操作
function handleUndo() {
  hideToast()
  // 调用 ClipboardPage 的 undoDelete 方法
  if (clipboardPageRef.value) {
    clipboardPageRef.value.undoDelete()
  }
}
</script>

<template>
  <div class="app">
    <!-- 顶部导航栏 -->
    <mdui-top-app-bar class="app-bar">
      <mdui-button-icon icon="cloud"></mdui-button-icon>
      <mdui-top-app-bar-title>云剪贴板</mdui-top-app-bar-title>
      <span style="font-size: 11px; color: rgba(255,255,255,0.6); margin-right: 8px;">版本: 1.1.45</span>
      <mdui-button-icon icon="account_circle"></mdui-button-icon>
    </mdui-top-app-bar>

    <!-- 主内容区 -->
    <main class="main-content">
      <!-- 剪贴板页面 -->
      <ClipboardPage
        ref="clipboardPageRef"
        v-if="currentTab === 'clipboard'"
        :user="user"
        :auth-loading="authLoading"
        @show-toast="showToastMessage"
      />

      <!-- 获取页面 -->
      <FetchPage
        v-else-if="currentTab === 'fetch'"
        @show-toast="showToastMessage"
      />

      <!-- 我的分享页面 -->
      <MySharesPage
        v-else-if="currentTab === 'my-shares'"
        :base-url="BASE_URL"
        @show-toast="showToastMessage"
      />

      <!-- 存储管理页面 -->
      <StoragePage
        v-else-if="currentTab === 'storage'"
        @show-toast="showToastMessage"
        @back="switchTab('profile')"
      />

      <!-- 管理员页面 -->
      <AdminPage
        v-else-if="currentTab === 'admin' && isAdmin"
        @show-toast="showToastMessage"
      />

      <!-- 个人中心页面 -->
      <ProfilePage
        v-else-if="currentTab === 'profile'"
        :user="user"
        :auth-loading="authLoading"
        @login="loginWithGitHub"
        @logout="logout"
        @show-storage="switchTab('storage')"
      />
    </main>

    <!-- Toast 提示 -->
    <Toast
      :message="toastMessage"
      :show="showToast"
      :show-undo="showUndoButton"
      @hide="hideToast"
      @undo="handleUndo"
    />

    <!-- 底部导航栏 -->
    <mdui-navigation-bar 
      class="bottom-nav"
      :value="currentTab === 'storage' ? 'profile' : currentTab"
      @change="(e: any) => switchTab(e.target.value)"
    >
      <mdui-navigation-bar-item icon="content_paste" value="clipboard">剪贴板</mdui-navigation-bar-item>
      <mdui-navigation-bar-item icon="download" value="fetch">获取</mdui-navigation-bar-item>
      <mdui-navigation-bar-item icon="share" value="my-shares">我的分享</mdui-navigation-bar-item>
      <mdui-navigation-bar-item v-if="isAdmin" icon="admin_panel_settings" value="admin">管理</mdui-navigation-bar-item>
      <mdui-navigation-bar-item icon="person" value="profile">我的</mdui-navigation-bar-item>
    </mdui-navigation-bar>
  </div>
</template>

<style>
.app {
  height: 100vh;
  background: var(--mdui-color-surface-container-low);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-bar {
  position: sticky;
  top: 0;
  z-index: 100;
  flex-shrink: 0;
}

.main-content {
  padding: 16px;
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
  flex: 1;
  overflow-y: auto;
  box-sizing: border-box;
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