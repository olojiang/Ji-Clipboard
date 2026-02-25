<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import MarkdownIt from 'markdown-it'

// 初始化 markdown-it
const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true
})

// API 基础地址
const API_BASE = import.meta.env.VITE_API_URL || 'https://ji-clipboard-worker.olojiang.workers.dev'

// 页面基础 URL（用于生成分享链接）- 使用完整路径
const BASE_URL = `${window.location.origin}${window.location.pathname.replace(/\/$/, '')}`

// 当前页面标签 - 默认剪贴板
const currentTab = ref('clipboard')

// 分享相关状态
const shareContent = ref('')
const shareCode = ref('')
const isSharing = ref(false)
const shareError = ref('')

// 获取相关状态
const fetchCode = ref('')
const isFetching = ref(false)
const fetchError = ref('')
const fetchedContent = ref('')
const fetchedCode = ref('')

// 计算属性：预览渲染的 Markdown
const renderedPreview = computed(() => {
  if (!shareContent.value) return '<p style="color: #999; text-align: center; padding: 40px;">开始输入 Markdown 内容...</p>'
  return md.render(shareContent.value)
})

// 计算属性：渲染获取到的内容
const renderedFetchedContent = computed(() => {
  if (!fetchedContent.value) return ''
  return md.render(fetchedContent.value)
})

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

// 我的分享列表状态
const showMyShares = ref(false)
const myShares = ref<Array<{
  code: string
  content: string
  type: string
  createdAt: number
  expiresAt: number
}>>([])
const mySharesLoading = ref(false)
const mySharesError = ref('')

// 写死的数据
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
  console.log('Page mounted, checking for session...')
  console.log('API_BASE:', API_BASE)

  // 检查 URL hash 中是否有标签页参数
  const hash = window.location.hash.replace('#', '')
  if (hash && ['clipboard', 'fetch', 'share', 'profile'].includes(hash)) {
    currentTab.value = hash
  }

  // 检查 URL 参数中是否有 session（用于 iOS Safari 等限制第三方 cookie 的浏览器）
  const urlParams = new URLSearchParams(window.location.search)
  const urlSession = urlParams.get('session')

  if (urlSession) {
    console.log('Found session in URL params, storing in localStorage...')
    localStorage.setItem('session_id', urlSession)
    // 清除 URL 参数
    urlParams.delete('session')
    const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '') + window.location.hash
    window.history.replaceState({}, '', newUrl)
  }

  // 延迟 1 秒后获取用户信息
  setTimeout(async () => {
    console.log('Fetching user info after delay...')
    await fetchUserInfo()
    authLoading.value = false
  }, 1000)
})

// 获取用户信息
async function fetchUserInfo() {
  try {
    // 从 localStorage 获取 session（用于 iOS Safari 等限制第三方 cookie 的浏览器）
    const localSession = localStorage.getItem('session_id')

    let url = `${API_BASE}/api/me`
    if (localSession) {
      url += `?session=${localSession}`
    }

    console.log('Fetching user info from:', url)
    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      }
    })
    console.log('Response status:', response.status)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    console.log('User data received:', data)
    user.value = data
  } catch (error) {
    console.error('获取用户信息失败:', error)
    console.error('Error details:', (error as Error).message, (error as Error).stack)
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
  } catch (error) {
    console.error('登出失败:', error)
  }
}

// 处理获取剪贴板
async function handleFetch() {
  if (!fetchCode.value || fetchCode.value.length !== 5) {
    fetchError.value = '请输入5位提取码'
    return
  }

  fetchError.value = ''
  isFetching.value = true
  fetchedContent.value = ''

  try {
    const response = await fetch(`${API_BASE}/api/clipboard?code=${fetchCode.value}`, {
      headers: {
        'Accept': 'application/json'
      }
    })

    if (response.status === 404) {
      fetchError.value = '内容不存在或已过期'
      isFetching.value = false
      return
    }

    if (response.status === 410) {
      fetchError.value = '内容已过期'
      isFetching.value = false
      return
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    fetchedContent.value = data.content
    fetchedCode.value = data.code
  } catch (error) {
    console.error('获取失败:', error)
    fetchError.value = '获取失败，请稍后重试'
  } finally {
    isFetching.value = false
  }
}

// 清除获取的内容
function clearFetchedContent() {
  fetchedContent.value = ''
  fetchedCode.value = ''
  fetchCode.value = ''
}

// 处理分享
async function handleShare() {
  if (!shareContent.value.trim()) {
    shareError.value = '请输入要分享的内容'
    return
  }

  shareError.value = ''
  isSharing.value = true
  shareCode.value = ''

  try {
    // 从 localStorage 获取 session（用于 iOS Safari 等限制第三方 cookie 的浏览器）
    const sessionId = localStorage.getItem('session_id')
    let url = `${API_BASE}/api/clipboard`
    if (sessionId) {
      url += `?session=${sessionId}`
    }

    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        content: shareContent.value,
        type: 'markdown',
        expireHours: 24
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    shareCode.value = data.code

    // 清空输入
    shareContent.value = ''
  } catch (error) {
    console.error('分享失败:', error)
    shareError.value = (error as Error).message || '分享失败，请重试'
  } finally {
    isSharing.value = false
  }
}

// 复制分享链接
function copyShareLink(code?: string) {
  const linkCode = code || shareCode.value
  if (linkCode) {
    const shareLink = `${BASE_URL}/view.html?code=${linkCode}`
    navigator.clipboard.writeText(shareLink).then(() => {
      alert('分享链接已复制到剪贴板！')
    }).catch(() => {
      // 降级方案
      const input = document.createElement('input')
      input.value = shareLink
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      alert('分享链接已复制到剪贴板！')
    })
  }
}

// 打开分享链接
function openShare(code: string) {
  window.open(`./view.html?code=${code}`, '_blank')
}

// 清空分享内容
function clearShareContent() {
  shareContent.value = ''
  shareCode.value = ''
  shareError.value = ''
}

function clearAll() {
  recentClips.value = []
}

// 获取我的分享列表
async function fetchMyShares() {
  mySharesLoading.value = true
  mySharesError.value = ''

  try {
    const sessionId = localStorage.getItem('session_id')
    let url = `${API_BASE}/api/my-shares`
    if (sessionId) {
      url += `?session=${sessionId}`
    }

    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    myShares.value = data.shares || []
  } catch (error) {
    console.error('获取分享列表失败:', error)
    mySharesError.value = '获取分享列表失败，请稍后重试'
  } finally {
    mySharesLoading.value = false
  }
}

// 关闭分享列表
function closeMyShares() {
  showMyShares.value = false
  myShares.value = []
  mySharesError.value = ''
}

// 格式化日期
function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function switchTab(tab: string) {
  currentTab.value = tab
  // 更新 URL hash
  window.history.replaceState({}, '', `#${tab}`)
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
      <template v-if="currentTab === 'clipboard'">
        <div class="section">
          <mdui-card class="clipboard-card">
            <div class="empty-state">
              <mdui-icon name="content_paste" style="font-size: 64px; opacity: 0.5;"></mdui-icon>
              <h2>剪贴板</h2>
              <p>功能开发中...</p>
            </div>
          </mdui-card>
        </div>
      </template>

      <!-- 获取页面 -->
      <template v-if="currentTab === 'fetch'">
        <!-- 显示获取到的内容 -->
        <div v-if="fetchedContent" class="section">
          <mdui-card class="content-display-card">
            <div class="content-header">
              <span class="content-code">提取码: {{ fetchedCode }}</span>
              <mdui-button variant="text" @click="clearFetchedContent">返回</mdui-button>
            </div>
            <div class="markdown-body" v-html="renderedFetchedContent"></div>
          </mdui-card>
        </div>

        <!-- 提取区域 -->
        <div v-else class="section">
          <mdui-card class="fetch-card">
            <h2 class="title">获取分享</h2>
            <p class="subtitle">输入5位提取码，立即获取分享的内容</p>

            <mdui-text-field
              v-model="fetchCode"
              label="5位提取码"
              maxlength="5"
              class="code-input"
              :error="!!fetchError"
              :error-text="fetchError"
            ></mdui-text-field>

            <mdui-button
              variant="filled"
              class="fetch-btn"
              :loading="isFetching"
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
          <!-- 加载中状态 -->
          <mdui-card v-if="authLoading" class="share-card">
            <div class="loading-state">
              <div class="spinner"></div>
              <p>正在检查登录状态...</p>
            </div>
          </mdui-card>

          <!-- 未登录状态 -->
          <mdui-card v-else-if="!user.loggedIn" class="share-card">
            <div class="login-required-state">
              <mdui-icon name="lock" style="font-size: 64px; color: var(--mdui-color-on-surface-variant);"></mdui-icon>
              <h3 class="login-required-title">需要登录</h3>
              <p class="login-required-subtitle">请先使用 GitHub 登录后再分享内容</p>
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
            </div>
          </mdui-card>

          <!-- 已登录状态 -->
          <mdui-card v-else class="share-card">
            <h2 class="title">分享剪贴板</h2>
            <p class="subtitle">输入 Markdown 内容，生成分享码</p>

            <!-- 分享成功状态 -->
            <div v-if="shareCode" class="success-state">
              <mdui-icon name="check_circle" style="font-size: 64px; color: var(--mdui-color-primary);"></mdui-icon>
              <h3 class="success-title">分享成功！</h3>
              <p class="success-subtitle">您的分享链接</p>
              <div class="share-link-display">{{ BASE_URL }}/view.html?code={{ shareCode }}</div>
              <div class="success-actions">
                <mdui-button variant="filled" @click="copyShareLink">
                  <mdui-icon slot="icon" name="content_copy"></mdui-icon>
                  复制分享链接
                </mdui-button>
                <mdui-button variant="text" @click="clearShareContent">
                  继续分享
                </mdui-button>
              </div>
            </div>

            <!-- 编辑状态 -->
            <template v-else>
              <div class="editor-container">
                <div class="editor-section">
                  <label class="section-label">
                    <mdui-icon name="edit" style="font-size: 16px;"></mdui-icon>
                    编辑
                  </label>
                  <textarea
                    v-model="shareContent"
                    class="markdown-editor"
                    placeholder="在此输入 Markdown 内容...&#10;支持标题、列表、代码块、链接等格式"
                    rows="12"
                  ></textarea>
                </div>

                <div class="preview-section">
                  <label class="section-label">
                    <mdui-icon name="preview" style="font-size: 16px;"></mdui-icon>
                    预览
                  </label>
                  <div class="markdown-preview" v-html="renderedPreview"></div>
                </div>
              </div>

              <div v-if="shareError" class="error-message">
                <mdui-icon name="error" style="font-size: 16px;"></mdui-icon>
                {{ shareError }}
              </div>

              <mdui-button
                variant="filled"
                class="share-btn"
                :loading="isSharing"
                :disabled="!shareContent.trim()"
                @click="handleShare"
              >
                <mdui-icon slot="icon" name="share"></mdui-icon>
                生成分享码
              </mdui-button>
            </template>
          </mdui-card>
        </div>
      </template>

      <!-- 我的页面（个人中心）-->
      <template v-if="currentTab === 'profile'">
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
              <mdui-list-item icon="history" headline="我的分享" @click="showMyShares = true; fetchMyShares()"></mdui-list-item>
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

      <!-- 我的分享列表全屏遮罩 -->
      <div
        v-if="showMyShares"
        class="fullscreen-overlay"
      >
        <div class="overlay-header">
          <mdui-top-app-bar class="overlay-app-bar">
            <mdui-button-icon icon="arrow_back" @click="closeMyShares"></mdui-button-icon>
            <mdui-top-app-bar-title>我的分享</mdui-top-app-bar-title>
          </mdui-top-app-bar>
        </div>

        <div class="overlay-content">
          <div v-if="mySharesLoading" class="loading-state">
            <div class="spinner"></div>
            <p>正在加载...</p>
          </div>

          <div v-else-if="mySharesError" class="error-state">
            <mdui-icon name="error_outline" style="font-size: 48px; color: var(--mdui-color-error);"></mdui-icon>
            <p>{{ mySharesError }}</p>
            <mdui-button variant="filled" @click="fetchMyShares">重试</mdui-button>
          </div>

          <div v-else-if="myShares.length === 0" class="empty-state">
            <mdui-icon name="inbox" style="font-size: 64px; opacity: 0.5;"></mdui-icon>
            <p>暂无分享内容</p>
          </div>

          <mdui-list v-else class="shares-list">
            <mdui-list-item
              v-for="share in myShares"
              :key="share.code"
              :headline="`提取码: ${share.code}`"
              :description="`${formatDate(share.createdAt)} · 过期: ${formatDate(share.expiresAt)}`"
              icon="description"
            >
              <div slot="end" style="display: flex; gap: 8px;">
                <mdui-button-icon
                  icon="content_copy"
                  @click="copyShareLink(share.code)"
                  title="复制链接"
                ></mdui-button-icon>
                <mdui-button-icon
                  icon="open_in_new"
                  @click="openShare(share.code)"
                  title="查看"
                ></mdui-button-icon>
              </div>
            </mdui-list-item>
          </mdui-list>
        </div>
      </div>
    </main>

    <!-- 底部导航栏 -->
    <mdui-navigation-bar
      class="bottom-nav"
      :value="currentTab"
      @change="(e: any) => switchTab(e.target.value)"
    >
      <mdui-navigation-bar-item icon="content_paste" value="clipboard">
        剪贴板
      </mdui-navigation-bar-item>

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
  max-width: 900px;
  margin: 0 auto;
}

.section {
  margin-bottom: 16px;
}

/* Fetch Card */
.fetch-card {
  padding: 24px;
  text-align: center;
  width: 100%;
  box-sizing: border-box;
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
  width: 100%;
  box-sizing: border-box;
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

/* Share Card */
.share-card {
  padding: 24px;
  width: 100%;
  box-sizing: border-box;
}

.share-card .title {
  text-align: center;
}

.share-card .subtitle {
  text-align: center;
}

.editor-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

@media (max-width: 768px) {
  .editor-container {
    grid-template-columns: 1fr;
  }
}

.editor-section,
.preview-section {
  display: flex;
  flex-direction: column;
}

.section-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--mdui-color-on-surface-variant);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.markdown-editor {
  flex: 1;
  min-height: 300px;
  padding: 16px;
  border: 1px solid var(--mdui-color-outline);
  border-radius: 8px;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
  background: var(--mdui-color-surface);
  color: var(--mdui-color-on-surface);
}

.markdown-editor:focus {
  outline: none;
  border-color: var(--mdui-color-primary);
}

.markdown-preview {
  flex: 1;
  min-height: 300px;
  padding: 16px;
  border: 1px solid var(--mdui-color-outline);
  border-radius: 8px;
  background: var(--mdui-color-surface);
  overflow-y: auto;
  line-height: 1.6;
}

.markdown-preview :deep(h1) {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 16px 0;
  color: var(--mdui-color-on-surface);
}

.markdown-preview :deep(h2) {
  font-size: 20px;
  font-weight: 600;
  margin: 24px 0 12px 0;
  color: var(--mdui-color-on-surface);
}

.markdown-preview :deep(h3) {
  font-size: 16px;
  font-weight: 600;
  margin: 20px 0 10px 0;
  color: var(--mdui-color-on-surface);
}

.markdown-preview :deep(p) {
  margin: 0 0 12px 0;
  color: var(--mdui-color-on-surface);
}

.markdown-preview :deep(ul),
.markdown-preview :deep(ol) {
  margin: 0 0 12px 0;
  padding-left: 24px;
}

.markdown-preview :deep(li) {
  margin: 4px 0;
}

.markdown-preview :deep(code) {
  background: var(--mdui-color-surface-container-highest);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  font-size: 0.9em;
}

.markdown-preview :deep(pre) {
  background: var(--mdui-color-surface-container-highest);
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 12px 0;
}

.markdown-preview :deep(pre code) {
  background: none;
  padding: 0;
}

.markdown-preview :deep(a) {
  color: var(--mdui-color-primary);
  text-decoration: none;
}

.markdown-preview :deep(a:hover) {
  text-decoration: underline;
}

.markdown-preview :deep(blockquote) {
  border-left: 4px solid var(--mdui-color-primary);
  margin: 12px 0;
  padding: 8px 16px;
  background: var(--mdui-color-surface-container-lowest);
  color: var(--mdui-color-on-surface-variant);
}

.markdown-preview :deep(hr) {
  border: none;
  border-top: 1px solid var(--mdui-color-outline);
  margin: 16px 0;
}

.markdown-preview :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
}

.markdown-preview :deep(th),
.markdown-preview :deep(td) {
  border: 1px solid var(--mdui-color-outline);
  padding: 8px 12px;
  text-align: left;
}

.markdown-preview :deep(th) {
  background: var(--mdui-color-surface-container-highest);
  font-weight: 600;
}

/* Content Display Card */
.content-display-card {
  padding: 24px;
}

.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--mdui-color-outline);
  margin-bottom: 24px;
}

.content-code {
  font-size: 14px;
  color: var(--mdui-color-on-surface-variant);
  font-family: 'SF Mono', Monaco, monospace;
}

.markdown-body {
  line-height: 1.8;
  color: var(--mdui-color-on-surface);
}

.markdown-body :deep(h1) {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 20px 0;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--mdui-color-outline);
}

.markdown-body :deep(h2) {
  font-size: 22px;
  font-weight: 600;
  margin: 28px 0 14px 0;
  color: var(--mdui-color-primary);
}

.markdown-body :deep(h3) {
  font-size: 18px;
  font-weight: 600;
  margin: 22px 0 10px 0;
}

.markdown-body :deep(p) {
  margin: 0 0 14px 0;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 0 0 14px 0;
  padding-left: 28px;
}

.markdown-body :deep(li) {
  margin: 6px 0;
}

.markdown-body :deep(code) {
  background: var(--mdui-color-surface-container-highest);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
  font-size: 0.9em;
}

.markdown-body :deep(pre) {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 16px 0;
}

.markdown-body :deep(pre code) {
  background: none;
  padding: 0;
  color: inherit;
}

.markdown-body :deep(a) {
  color: var(--mdui-color-primary);
  text-decoration: none;
}

.markdown-body :deep(a:hover) {
  text-decoration: underline;
}

.markdown-body :deep(blockquote) {
  border-left: 4px solid var(--mdui-color-primary);
  margin: 16px 0;
  padding: 12px 20px;
  background: var(--mdui-color-surface-container-lowest);
  font-style: italic;
}

.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid var(--mdui-color-outline);
  padding: 10px 14px;
  text-align: left;
}

.markdown-body :deep(th) {
  background: var(--mdui-color-surface-container-highest);
  font-weight: 600;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--mdui-color-error);
  font-size: 14px;
  margin-bottom: 16px;
  padding: 12px;
  background: var(--mdui-color-error-container);
  border-radius: 8px;
}

.share-btn {
  width: 100%;
  --mdui-button-height: 48px;
}

/* Success State */
.success-state {
  text-align: center;
  padding: 32px 16px;
}

.success-title {
  font-size: 20px;
  font-weight: 600;
  margin: 16px 0 8px 0;
  color: var(--mdui-color-on-surface);
}

.success-subtitle {
  font-size: 14px;
  color: var(--mdui-color-on-surface-variant);
  margin: 0 0 16px 0;
}

.share-code-display {
  font-size: 48px;
  font-weight: 700;
  letter-spacing: 8px;
  color: var(--mdui-color-primary);
  margin: 16px 0 24px 0;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
}

.share-link-display {
  font-size: 14px;
  font-weight: 500;
  color: var(--mdui-color-primary);
  margin: 16px 0 24px 0;
  padding: 12px 16px;
  background: var(--mdui-color-surface-container-highest);
  border-radius: 8px;
  word-break: break-all;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
}

.success-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

/* Login Required State */
.login-required-state {
  text-align: center;
  padding: 48px 24px;
}

.login-required-title {
  font-size: 20px;
  font-weight: 600;
  margin: 24px 0 8px 0;
  color: var(--mdui-color-on-surface);
}

.login-required-subtitle {
  font-size: 14px;
  color: var(--mdui-color-on-surface-variant);
  margin: 0 0 24px 0;
}

/* Clipboard Card */
.clipboard-card {
  padding: 48px 24px;
  width: 100%;
  box-sizing: border-box;
}

/* My Shares Dialog */
.loading-state,
.error-state,
.empty-state {
  text-align: center;
  padding: 48px 24px;
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

.error-state mdui-icon,
.empty-state mdui-icon {
  margin-bottom: 16px;
}

/* Fullscreen Overlay */
.fullscreen-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--mdui-color-surface-container-low);
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.overlay-header {
  flex-shrink: 0;
  background: var(--mdui-color-surface);
  border-bottom: 1px solid var(--mdui-color-outline-variant);
}

.overlay-app-bar {
  position: relative;
}

.overlay-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: var(--mdui-color-surface-container-low);
}

.shares-list {
  padding: 0;
  background: var(--mdui-color-surface);
  border-radius: 12px;
}

/* Profile Card */
.profile-card {
  padding: 32px 24px;
  width: 100%;
  box-sizing: border-box;
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