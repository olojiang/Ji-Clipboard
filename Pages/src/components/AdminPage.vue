<script setup lang="ts">
import { ref, onMounted } from 'vue'
import MarkdownIt from 'markdown-it'
import ClipboardItem from './ClipboardItem.vue'

// 初始化 markdown-it
const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true
})

const emit = defineEmits(['showToast'])

const API_BASE = import.meta.env.VITE_API_URL || 'https://ji-clipboard-worker.olojiang.workers.dev'

// 当前标签
const currentTab = ref('shares')

// 分享列表
const shares = ref<any[]>([])
const sharesLoading = ref(false)

// 存储统计
const storageStats = ref<any>(null)
const storageLoading = ref(false)

// 用户详情页面
const showUserDetail = ref(false)
const selectedUser = ref<any>(null)
const userDetailLoading = ref(false)
const userDetail = ref<any>(null)
const userDetailTab = ref('shares') // 'shares' | 'storage'

// 分享详情页面
const showShareDetail = ref(false)
const selectedShare = ref<any>(null)

// 页面加载时获取数据
onMounted(() => {
  fetchAllShares()
  fetchStorageStats()
})

// 格式化日期
function formatDate(timestamp: number): string {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 获取权限文本
function getVisibilityText(visibility: string): string {
  const map: Record<string, string> = {
    'public': '公开',
    'authenticated': '登录用户',
    'private': '私密'
  }
  return map[visibility] || visibility
}

// 获取文本内容的简短显示
function getTextPreview(content: string, maxLength: number = 20): string {
  let text = content
  if (text.startsWith('[') || text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) {
        return `[${parsed.length} 张图片]`
      }
      if (parsed && typeof parsed === 'object') {
        return parsed.originalName || parsed.name || parsed.filename || '文件'
      }
    } catch {
      // 解析失败，继续处理
    }
  }
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
}

// 解析图片内容
function parseImageContent(content: string): string[] {
  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed)) {
      return parsed
    }
  } catch (e) {
    // 如果不是 JSON，返回空数组
  }
  return []
}

// 渲染 Markdown 内容
function renderMarkdown(content: string): string {
  return md.render(content)
}

// 获取所有分享
async function fetchAllShares() {
  sharesLoading.value = true
  try {
    const sessionId = localStorage.getItem('session_id')
    let url = `${API_BASE}/api/admin/shares`
    if (sessionId) {
      url += `?session=${sessionId}`
    }

    const response = await fetch(url, {
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    })

    if (!response.ok) {
      throw new Error('获取分享列表失败')
    }

    const data = await response.json()
    shares.value = data.shares || []
  } catch (error) {
    console.error('获取分享列表失败:', error)
    emit('showToast', '获取分享列表失败')
  } finally {
    sharesLoading.value = false
  }
}

// 获取存储统计
async function fetchStorageStats() {
  storageLoading.value = true
  try {
    const sessionId = localStorage.getItem('session_id')
    let url = `${API_BASE}/api/admin/storage-stats`
    if (sessionId) {
      url += `?session=${sessionId}`
    }

    const response = await fetch(url, {
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    })

    if (!response.ok) {
      throw new Error('获取存储统计失败')
    }

    const data = await response.json()
    
    // 确保数据格式正确
    if (!data.users) data.users = []
    if (!data.summary) {
      data.summary = {
        totalUsers: 0,
        totalSize: 0,
        totalImages: 0,
        totalFiles: 0
      }
    }
    
    storageStats.value = data
  } catch (error: any) {
    console.error('获取存储统计失败:', error)
    emit('showToast', '获取存储统计失败: ' + error.message)
    storageStats.value = null
  } finally {
    storageLoading.value = false
  }
}

// 切换标签
function switchTab(tab: string) {
  currentTab.value = tab
}

// 查看用户详情
async function viewUserDetail(user: any) {
  selectedUser.value = user
  showUserDetail.value = true
  userDetailTab.value = 'shares'
  userDetailLoading.value = true
  
  try {
    const sessionId = localStorage.getItem('session_id')
    let url = `${API_BASE}/api/admin/users/${user.userId}`
    if (sessionId) {
      url += `?session=${sessionId}`
    }

    const response = await fetch(url, {
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    })

    if (!response.ok) {
      throw new Error('获取用户详情失败')
    }

    const data = await response.json()
    userDetail.value = data
  } catch (error: any) {
    console.error('获取用户详情失败:', error)
    emit('showToast', '获取用户详情失败: ' + error.message)
    userDetail.value = null
  } finally {
    userDetailLoading.value = false
  }
}

// 切换用户详情标签
function switchUserDetailTab(tab: string) {
  userDetailTab.value = tab
}

// 关闭用户详情
function closeUserDetail() {
  showUserDetail.value = false
  selectedUser.value = null
  userDetail.value = null
  userDetailTab.value = 'shares'
}

// 删除用户图片
async function deleteUserImage(image: any) {
  if (!confirm(`确定要删除图片 "${image.name || image.filename}" 吗？`)) {
    return
  }

  try {
    const sessionId = localStorage.getItem('session_id')
    let url = `${API_BASE}/api/admin/users/${selectedUser.value.userId}/images/${image.id}`
    if (sessionId) {
      url += `?session=${sessionId}`
    }

    const response = await fetch(url, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    })

    if (!response.ok) {
      throw new Error('删除图片失败')
    }

    emit('showToast', '图片已删除')
    // 刷新用户详情
    await viewUserDetail(selectedUser.value)
  } catch (error: any) {
    console.error('删除图片失败:', error)
    emit('showToast', '删除图片失败: ' + error.message)
  }
}

// 删除用户文件
async function deleteUserFile(file: any) {
  if (!confirm(`确定要删除文件 "${file.name || file.filename}" 吗？`)) {
    return
  }

  try {
    const sessionId = localStorage.getItem('session_id')
    let url = `${API_BASE}/api/admin/users/${selectedUser.value.userId}/files/${file.id}`
    if (sessionId) {
      url += `?session=${sessionId}`
    }

    const response = await fetch(url, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    })

    if (!response.ok) {
      throw new Error('删除文件失败')
    }

    emit('showToast', '文件已删除')
    // 刷新用户详情
    await viewUserDetail(selectedUser.value)
  } catch (error: any) {
    console.error('删除文件失败:', error)
    emit('showToast', '删除文件失败: ' + error.message)
  }
}

// 删除分享
async function deleteShare(shareId: string) {
  if (!confirm('确定要删除这个分享吗？')) {
    return
  }

  try {
    const sessionId = localStorage.getItem('session_id')
    let url = `${API_BASE}/api/admin/shares/${shareId}`
    if (sessionId) {
      url += `?session=${sessionId}`
    }

    const response = await fetch(url, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    })

    if (!response.ok) {
      throw new Error('删除失败')
    }

    emit('showToast', '分享已删除')
    await fetchAllShares()
    // 如果当前在分享详情页，关闭它
    if (showShareDetail.value) {
      closeShareDetail()
    }
  } catch (error) {
    console.error('删除分享失败:', error)
    emit('showToast', '删除分享失败')
  }
}

// 打开分享详情
function openShareDetail(share: any) {
  selectedShare.value = share
  showShareDetail.value = true
}

// 关闭分享详情
function closeShareDetail() {
  showShareDetail.value = false
  setTimeout(() => {
    selectedShare.value = null
  }, 300)
}

// 复制分享码
function copyShareCode(shareId: string) {
  navigator.clipboard.writeText(shareId).then(() => {
    emit('showToast', '分享码已复制')
  }).catch(() => {
    const input = document.createElement('input')
    input.value = shareId
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    emit('showToast', '分享码已复制')
  })
}

// 复制分享链接
function copyShareLink(shareId: string) {
  const shareLink = `https://olojiang.github.io/Ji-Clipboard/?share=${shareId}`
  navigator.clipboard.writeText(shareLink).then(() => {
    emit('showToast', '分享链接已复制')
  }).catch(() => {
    const input = document.createElement('input')
    input.value = shareLink
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    emit('showToast', '分享链接已复制')
  })
}

// 打开分享
function openShare(shareId: string) {
  window.open(`./?share=${shareId}`, '_blank')
}
</script>

<template>
  <div class="admin-page">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2 class="page-title">管理员控制台</h2>
    </div>

    <!-- 标签切换 -->
    <div class="tabs">
      <mdui-chip
        :selected="currentTab === 'shares'"
        @click="switchTab('shares')"
        style="cursor: pointer;"
      >
        <mdui-icon slot="icon" name="share"></mdui-icon>
        所有分享
      </mdui-chip>
      <mdui-chip
        :selected="currentTab === 'storage'"
        @click="switchTab('storage')"
        style="cursor: pointer;"
      >
        <mdui-icon slot="icon" name="storage"></mdui-icon>
        存储统计
      </mdui-chip>
    </div>

    <!-- 分享列表 -->
    <div v-if="currentTab === 'shares'">
      <mdui-card class="content-card">
        <div class="card-header">
          <span class="card-title">所有分享 ({{ shares.length }})</span>
          <mdui-button variant="text" @click="fetchAllShares" :loading="sharesLoading">
            <mdui-icon slot="icon" name="refresh"></mdui-icon>
            刷新
          </mdui-button>
        </div>

        <div v-if="sharesLoading" class="loading-state">
          <div class="spinner"></div>
          <p>正在加载...</p>
        </div>

        <div v-else-if="shares.length === 0" class="empty-state">
          <mdui-icon name="inbox" style="font-size: 64px; opacity: 0.5;"></mdui-icon>
          <p>暂无分享</p>
        </div>

        <mdui-list v-else class="shares-list">
          <div
            v-for="share in shares"
            :key="share.id"
            class="share-item"
            @click="openShareDetail(share)"
            style="cursor: pointer;"
          >
            <div class="share-content">
              <div class="share-header">
                <mdui-chip icon="tag" variant="outlined" size="small" style="font-family: monospace;"
                  >#{{ share.id }}</mdui-chip>
                <span class="share-owner">@{{ share.ownerLogin }}</span>
                <mdui-chip size="small" variant="outlined">{{ getVisibilityText(share.visibility) }}</mdui-chip>
              </div>
              
              <!-- 内容概要 - 使用 items 数组或 content 字符串 -->
              <div class="share-items-row">
                <template v-if="share.items && share.items.length > 0">
                  <template v-for="(item, index) in share.items" :key="index">
                    <!-- 文本内容 - 直接显示 -->
                    <span v-if="item.type === 'text'" class="text-content">
                      {{ getTextPreview(item.content, 20) }}
                    </span>
                    
                    <!-- 图片 -->
                    <mdui-chip v-else-if="item.type === 'image'" size="small" variant="outlined" class="image-chip">
                      <mdui-icon slot="icon" name="image"></mdui-icon>
                      图片
                    </mdui-chip>
                    
                    <!-- 文件 -->
                    <mdui-chip v-else-if="item.type === 'file'" size="small" variant="outlined" class="file-chip">
                      <mdui-icon slot="icon" name="insert_drive_file"></mdui-icon>
                      {{ getTextPreview(item.content, 10) }}
                    </mdui-chip>
                  </template>
                </template>
                
                <!-- 旧格式：使用 content 字符串 -->
                <template v-else-if="share.content">
                  <span class="text-content">{{ getTextPreview(share.content, 30) }}</span>
                </template>
              </div>
              
              <div class="share-date">{{ formatDate(share.createdAt) }}</div>
            </div>
            <mdui-button-icon
              icon="delete"
              style="color: var(--mdui-color-error);"
              @click="deleteShare(share.id)"
              title="删除"
            ></mdui-button-icon>
          </div>
        </mdui-list>
      </mdui-card>
    </div>

    <!-- 存储统计 -->
    <div v-else-if="currentTab === 'storage'">
      <mdui-card v-if="storageStats" class="content-card">
        <div class="card-header">
          <span class="card-title">存储概览</span>
          <mdui-button variant="text" @click="fetchStorageStats" :loading="storageLoading">
            <mdui-icon slot="icon" name="refresh"></mdui-icon>
            刷新
          </mdui-button>
        </div>

        <div class="stats-summary">
          <div class="stat-item">
            <span class="stat-value">{{ storageStats.summary?.totalUsers || 0 }}</span>
            <span class="stat-label">用户总数</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ formatFileSize(storageStats.summary?.totalSize || 0) }}</span>
            <span class="stat-label">总存储</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ storageStats.summary?.totalImages || 0 }}</span>
            <span class="stat-label">图片总数</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ storageStats.summary?.totalFiles || 0 }}</span>
            <span class="stat-label">文件总数</span>
          </div>
        </div>
      </mdui-card>

      <mdui-card v-if="storageStats?.users" class="content-card">
        <div class="card-header">
          <span class="card-title">用户存储详情 ({{ storageStats.users.length }})</span>
        </div>

        <div v-if="storageLoading" class="loading-state">
          <div class="spinner"></div>
          <p>正在加载...</p>
        </div>

        <mdui-list v-else class="users-list">
          <mdui-list-item
            v-for="user in storageStats.users"
            :key="user.userId"
            class="user-item"
            @click="viewUserDetail(user)"
            style="cursor: pointer;"
          >
            <div class="user-info" style="width: 100%;">
              <div class="user-name-row">
                <img v-if="user.userAvatar" :src="user.userAvatar" class="user-avatar" alt="avatar" />
                <mdui-icon v-else name="person" class="user-avatar-placeholder"></mdui-icon>
                <span class="user-login">@{{ user.userLogin || '未知用户' }}</span>
              </div>
              <div class="user-stats">
                <mdui-chip size="small" variant="outlined">{{ formatFileSize(user.totalSize || 0) }}</mdui-chip>
                <mdui-chip size="small" variant="outlined">{{ user.imagesCount || 0 }} 张图片</mdui-chip>
                <mdui-chip size="small" variant="outlined">{{ user.filesCount || 0 }} 个文件</mdui-chip>
              </div>
            </div>
            <mdui-icon slot="end-icon" name="chevron_right"></mdui-icon>
          </mdui-list-item>
        </mdui-list>
      </mdui-card>
    </div>

    <!-- 用户详情全屏页面 -->
    <div v-if="showUserDetail" class="user-detail-page">
      <!-- 页面头部 -->
      <div class="user-detail-page-header">
        <mdui-button-icon icon="arrow_back" @click="closeUserDetail"></mdui-button-icon>
        <span class="user-detail-page-title">用户详情</span>
        <div style="width: 40px;"></div>
      </div>

      <!-- 加载中 -->
      <div v-if="userDetailLoading" class="user-detail-loading">
        <div class="spinner"></div>
        <p>正在加载用户详情...</p>
      </div>

      <!-- 用户详情内容 -->
      <div v-else-if="userDetail" class="user-detail-page-content">
        <!-- 用户信息卡片 -->
        <mdui-card class="user-info-card">
          <div class="user-info-header">
            <img v-if="userDetail.user?.userAvatar" :src="userDetail.user.userAvatar" class="user-avatar-large" alt="avatar" />
            <mdui-icon v-else name="person" class="user-avatar-large-placeholder"></mdui-icon>
            <div class="user-info-text">
              <h3>@{{ userDetail.user?.userLogin }}</h3>
              <p v-if="userDetail.user?.userName">{{ userDetail.user.userName }}</p>
              <p v-if="userDetail.user?.userEmail" class="user-email">{{ userDetail.user.userEmail }}</p>
            </div>
          </div>
        </mdui-card>

        <!-- 统计概览 -->
        <mdui-card class="stats-overview-card">
          <div class="stats-grid">
            <div class="stat-box">
              <span class="stat-box-value">{{ formatFileSize(userDetail.storage?.totalSize || 0) }}</span>
              <span class="stat-box-label">总存储</span>
            </div>
            <div class="stat-box">
              <span class="stat-box-value">{{ userDetail.storage?.imagesCount || 0 }}</span>
              <span class="stat-box-label">图片</span>
            </div>
            <div class="stat-box">
              <span class="stat-box-value">{{ userDetail.storage?.filesCount || 0 }}</span>
              <span class="stat-box-label">文件</span>
            </div>
            <div class="stat-box">
              <span class="stat-box-value">{{ userDetail.shares?.length || 0 }}</span>
              <span class="stat-box-label">分享</span>
            </div>
          </div>
        </mdui-card>

        <!-- 标签切换 -->
        <div class="detail-tabs">
          <mdui-chip
            :selected="userDetailTab === 'shares'"
            @click="switchUserDetailTab('shares')"
            style="cursor: pointer;"
          >
            <mdui-icon slot="icon" name="share"></mdui-icon>
            分享 ({{ userDetail.shares?.length || 0 }})
          </mdui-chip>
          <mdui-chip
            :selected="userDetailTab === 'storage'"
            @click="switchUserDetailTab('storage')"
            style="cursor: pointer;"
          >
            <mdui-icon slot="icon" name="folder"></mdui-icon>
            存储
          </mdui-chip>
        </div>

        <!-- 分享列表 -->
        <div v-if="userDetailTab === 'shares'" class="detail-content">
          <div v-if="!userDetail.shares || userDetail.shares.length === 0" class="empty-state">
            <mdui-icon name="inbox" style="font-size: 64px; opacity: 0.5;"></mdui-icon>
            <p>暂无分享</p>
          </div>
          <mdui-card v-else class="detail-list-card">
            <div
              v-for="share in userDetail.shares"
              :key="share.id"
              class="share-item"
              @click="openShareDetail(share)"
              style="cursor: pointer;"
            >
              <div class="share-content">
                <div class="share-header">
                  <mdui-chip icon="tag" variant="outlined" size="small" style="font-family: monospace;"
                    >#{{ share.id }}</mdui-chip>
                  <mdui-chip size="small" variant="outlined">{{ getVisibilityText(share.visibility) }}</mdui-chip>
                </div>
                
                <!-- 内容概要 -->
                <div class="share-items-row">
                  <template v-if="share.items && share.items.length > 0">
                    <template v-for="(item, index) in share.items" :key="index">
                      <span v-if="item.type === 'text'" class="text-content">
                        {{ getTextPreview(item.content, 20) }}
                      </span>
                      <mdui-chip v-else-if="item.type === 'image'" size="small" variant="outlined" class="image-chip">
                        <mdui-icon slot="icon" name="image"></mdui-icon>
                        图片
                      </mdui-chip>
                      <mdui-chip v-else-if="item.type === 'file'" size="small" variant="outlined" class="file-chip">
                        <mdui-icon slot="icon" name="insert_drive_file"></mdui-icon>
                        {{ getTextPreview(item.content, 10) }}
                      </mdui-chip>
                    </template>
                  </template>
                  <template v-else-if="share.content">
                    <span class="text-content">{{ getTextPreview(share.content, 30) }}</span>
                  </template>
                </div>
                
                <div class="share-date">{{ formatDate(share.createdAt) }}</div>
              </div>
            </div>
          </mdui-card>
        </div>

        <!-- 存储列表 -->
        <div v-else-if="userDetailTab === 'storage'" class="detail-content">
          <!-- 图片列表 -->
          <mdui-card v-if="userDetail.storage?.images && userDetail.storage.images.length > 0" class="detail-list-card">
            <div class="card-header">
              <span class="card-title">图片 ({{ userDetail.storage.images.length }})</span>
            </div>
            <div class="image-grid">
              <div v-for="image in userDetail.storage.images" :key="image.id" class="image-item">
                <div class="image-wrapper">
                  <img :src="image.url || image.publicUrl || image.previewUrl" :alt="image.name || image.filename" @error="$event.target.style.display='none'" />
                  <mdui-button-icon
                    icon="delete"
                    class="delete-image-btn"
                    @click="deleteUserImage(image)"
                    title="删除图片"
                  ></mdui-button-icon>
                </div>
                <span class="image-name">{{ image.name || image.filename }}</span>
                <span class="image-size">{{ formatFileSize(image.size) }}</span>
              </div>
            </div>
          </mdui-card>

          <!-- 文件列表 -->
          <mdui-card v-if="userDetail.storage?.files && userDetail.storage.files.length > 0" class="detail-list-card">
            <div class="card-header">
              <span class="card-title">文件 ({{ userDetail.storage.files.length }})</span>
            </div>
            <mdui-list>
              <mdui-list-item
                v-for="file in userDetail.storage.files"
                :key="file.id"
              >
                <mdui-icon slot="icon" name="insert_drive_file"></mdui-icon>
                <div slot="headline">{{ file.name || file.filename }}</div>
                <div slot="description">{{ formatFileSize(file.size) }} · {{ formatDate(file.uploadedAt || file.createdAt) }}</div>
                <mdui-button-icon
                  slot="end-icon"
                  icon="delete"
                  style="color: var(--mdui-color-error);"
                  @click="deleteUserFile(file)"
                  title="删除文件"
                ></mdui-button-icon>
              </mdui-list-item>
            </mdui-list>
          </mdui-card>

          <div v-if="(!userDetail.storage?.images || userDetail.storage.images.length === 0) && (!userDetail.storage?.files || userDetail.storage.files.length === 0)" class="empty-state">
            <mdui-icon name="folder_open" style="font-size: 64px; opacity: 0.5;"></mdui-icon>
            <p>暂无存储内容</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 分享详情全屏页面 -->
    <div v-if="showShareDetail" class="share-detail-page">
      <!-- 页面头部 -->
      <div class="share-detail-header">
        <mdui-button-icon icon="arrow_back" @click="closeShareDetail"></mdui-button-icon>
        <span class="share-detail-title">分享详情</span>
        <div style="width: 40px;"></div>
      </div>

      <!-- 页面内容 -->
      <div v-if="selectedShare" class="share-detail-content">
        <mdui-card class="share-detail-card">
          <!-- 分享码 -->
          <div class="detail-section">
            <div class="detail-label">分享码</div>
            <div class="detail-value-row">
              <mdui-chip icon="tag" variant="outlined" class="share-code-chip">
                #{{ selectedShare.id }}
              </mdui-chip>
              <mdui-button-icon icon="content_copy" @click="copyShareCode(selectedShare.id)" title="复制分享码">
              </mdui-button-icon>
            </div>
          </div>

          <!-- 分享者 -->
          <div class="detail-section">
            <div class="detail-label">分享者</div>
            <div class="detail-value-row">
              <span class="share-owner">@{{ selectedShare.ownerLogin }}</span>
            </div>
          </div>

          <!-- 内容 -->
          <div class="detail-section">
            <div class="detail-label">分享内容</div>
            <!-- 使用 items 数组显示（与我的分享页面一致） -->
            <div v-if="selectedShare.items && selectedShare.items.length > 0" class="detail-content-box">
              <template v-for="(item, index) in selectedShare.items" :key="index">
                <span v-if="item.type === 'text'" class="text-content">
                  {{ getTextPreview(item.content, 50) }}
                </span>
                <mdui-chip v-else-if="item.type === 'image'" size="small" variant="outlined" class="image-chip">
                  <mdui-icon slot="icon" name="image"></mdui-icon>
                  图片
                </mdui-chip>
                <mdui-chip v-else-if="item.type === 'file'" size="small" variant="outlined" class="file-chip">
                  <mdui-icon slot="icon" name="insert_drive_file"></mdui-icon>
                  {{ getTextPreview(item.content, 15) }}
                </mdui-chip>
              </template>
            </div>
            <!-- 旧格式兼容 -->
            <div v-else-if="selectedShare.content" class="detail-content-box">
              <span class="text-content">{{ getTextPreview(selectedShare.content, 50) }}</span>
            </div>
            <div v-else class="detail-content-box">
              <span style="color: #999;">无内容</span>
            </div>
          </div>

          <!-- 信息 -->
          <div class="detail-section">
            <div class="detail-label">分享信息</div>
            <div class="detail-info-row">
              <span class="detail-info-label">权限</span>
              <mdui-chip size="small" variant="outlined">{{ getVisibilityText(selectedShare.visibility) }}</mdui-chip>
            </div>
            <div class="detail-info-row">
              <span class="detail-info-label">创建时间</span>
              <span>{{ formatDate(selectedShare.createdAt) }}</span>
            </div>
            <div class="detail-info-row">
              <span class="detail-info-label">过期时间</span>
              <span>{{ formatDate(selectedShare.expiresAt) }}</span>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="detail-actions">
            <mdui-button variant="filled" @click="copyShareLink(selectedShare.id)" style="flex: 1;">
              <mdui-icon slot="icon" name="link"></mdui-icon>
              复制链接
            </mdui-button>
            <mdui-button variant="outlined" @click="openShare(selectedShare.id)" style="flex: 1;">
              <mdui-icon slot="icon" name="open_in_new"></mdui-icon>
              打开分享
            </mdui-button>
          </div>

          <mdui-button variant="text" @click="deleteShare(selectedShare.id)" style="color: var(--mdui-color-error); margin-top: 8px;">
            <mdui-icon slot="icon" name="delete"></mdui-icon>
            删除分享
          </mdui-button>
        </mdui-card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-page {
  height: 100%;
  overflow-y: auto;
  padding: 16px;
  box-sizing: border-box;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 0 8px;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--mdui-color-on-surface);
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  padding: 0 8px;
}

.content-card {
  margin-bottom: 16px;
  max-width: 800px;
  width: 100%;
  margin-left: auto;
  margin-right: auto;
  box-sizing: border-box;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--mdui-color-on-surface-variant);
}

.loading-state, .empty-state {
  text-align: center;
  padding: 48px 24px;
  color: var(--mdui-color-on-surface-variant);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--mdui-color-surface-container-highest);
  border-top-color: var(--mdui-color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.shares-list, .users-list {
  padding: 0;
}

.share-item {
  display: flex;
  align-items: flex-start;
  padding: 12px 16px;
  border-bottom: 1px solid var(--mdui-color-surface-container-highest);
  gap: 12px;
}

.share-item:last-child {
  border-bottom: none;
}

.share-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.share-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.share-owner {
  font-size: 12px;
  color: var(--mdui-color-primary);
}

.share-visibility {
  padding: 2px 8px;
  background: var(--mdui-color-primary-container);
  border-radius: 4px;
  color: var(--mdui-color-on-primary-container);
  font-size: 11px;
}

.share-text {
  font-size: 14px;
  color: var(--mdui-color-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.share-date {
  font-size: 12px;
  color: var(--mdui-color-on-surface-variant);
}

.share-items-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin: 8px 0;
}

.text-content {
  font-size: 14px;
  color: var(--mdui-color-on-surface);
}

.image-chip {
  --mdui-chip-outline-color: var(--mdui-color-tertiary-container);
  color: var(--mdui-color-tertiary);
}

.file-chip {
  --mdui-chip-outline-color: var(--mdui-color-secondary-container);
  color: var(--mdui-color-secondary);
}

/* 分享详情全屏页面 */
.share-detail-page {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(245, 245, 250, 0.98);
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.share-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid var(--mdui-color-outline-variant);
}

.share-detail-title {
  font-size: 18px;
  font-weight: 600;
}

.share-detail-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.share-detail-card {
  padding: 16px;
  min-height: calc(100vh - 80px);
  box-sizing: border-box;
}

.detail-section {
  margin-bottom: 24px;
}

.detail-label {
  font-size: 15px;
  font-weight: 500;
  color: var(--mdui-color-on-surface-variant);
  margin-bottom: 8px;
}

.detail-value-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-content-box {
  padding: 12px 16px;
  background: var(--mdui-color-surface-container);
  border-radius: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.detail-info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--mdui-color-outline-variant);
}

.detail-info-row:last-child {
  border-bottom: none;
}

.detail-info-label {
  color: var(--mdui-color-on-surface-variant);
  font-size: 14px;
}

.detail-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

/* Markdown 渲染样式 */
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
  font-family: 'SF Mono', Monaco, monospace;
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

/* 批量分享样式 */
.batch-share-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.batch-share-header {
  text-align: center;
  margin-bottom: 4px;
}

.batch-share-count {
  font-size: 14px;
  color: var(--mdui-color-on-surface-variant);
  background: var(--mdui-color-surface-container);
  padding: 6px 16px;
  border-radius: 16px;
}

.batch-item-card {
  padding: 16px;
  background: var(--mdui-color-surface);
}

.batch-item-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--mdui-color-surface-container-highest);
}

.batch-item-number {
  font-size: 14px;
  font-weight: 600;
  color: var(--mdui-color-primary);
  font-family: monospace;
}

/* 图片分享样式 */
.image-share-content {
  padding: 8px 0;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}

.share-image {
  width: 100%;
  height: 150px;
  object-fit: cover;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.2s;
}

.share-image:hover {
  transform: scale(1.02);
}

/* 文件分享样式 */
.file-share-content {
  padding: 24px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.file-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px;
  background: var(--mdui-color-surface-container);
  border-radius: 12px;
  text-align: center;
}

.file-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-name {
  font-size: 16px;
  font-weight: 500;
  color: var(--mdui-color-on-surface);
  word-break: break-all;
  max-width: 250px;
}

.stats-summary {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  padding: 16px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
  background: var(--mdui-color-surface-container);
  border-radius: 8px;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--mdui-color-primary);
}

.stat-label {
  font-size: 12px;
  color: var(--mdui-color-on-surface-variant);
  margin-top: 4px;
}

.user-item {
  --mdui-list-item-leading-space: 16px;
  --mdui-list-item-trailing-space: 16px;
}

.user-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
}

.user-avatar-placeholder {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--mdui-color-surface-container-highest);
  color: var(--mdui-color-on-surface-variant);
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-login {
  font-weight: 500;
}

.user-stats {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

/* 用户详情全屏页面 */
.user-detail-page {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #f5f5f5;
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

/* 遮罩层 */
.user-detail-page::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #f5f5f5;
  z-index: -1;
}

.user-detail-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--mdui-color-surface);
  border-bottom: 1px solid var(--mdui-color-surface-container-highest);
}

.user-detail-page-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--mdui-color-on-surface);
}

.user-detail-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
}

.user-detail-page-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.user-info-card {
  margin-bottom: 16px;
}

.user-info-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
}

.user-avatar-large {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
}

.user-avatar-large-placeholder {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: var(--mdui-color-surface-container-highest);
  color: var(--mdui-color-on-surface-variant);
  font-size: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-info-text h3 {
  margin: 0 0 4px 0;
  font-size: 20px;
  color: var(--mdui-color-on-surface);
}

.user-info-text p {
  margin: 0;
  color: var(--mdui-color-on-surface-variant);
  font-size: 14px;
}

.user-info-text .user-email {
  color: var(--mdui-color-primary);
  font-size: 13px;
}

.stats-overview-card {
  margin-bottom: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  padding: 16px;
}

.stat-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
  background: var(--mdui-color-surface-container);
  border-radius: 8px;
}

.stat-box-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--mdui-color-primary);
}

.stat-box-label {
  font-size: 12px;
  color: var(--mdui-color-on-surface-variant);
  margin-top: 4px;
}

.detail-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.detail-content {
}

.detail-list-card {
  margin-bottom: 16px;
}

.share-visibility-tag {
  margin-left: 8px;
  padding: 2px 8px;
  background: var(--mdui-color-primary-container);
  border-radius: 4px;
  color: var(--mdui-color-on-primary-container);
  font-size: 11px;
}

.share-description {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.share-content-preview {
  font-size: 14px;
  color: var(--mdui-color-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.share-time {
  font-size: 12px;
  color: var(--mdui-color-on-surface-variant);
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
  padding: 16px;
}

.image-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.image-wrapper {
  position: relative;
  width: 100%;
}

.image-wrapper img {
  width: 100%;
  height: 120px;
  object-fit: cover;
  border-radius: 8px;
}

.delete-image-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  --mdui-color-on-surface-variant: white;
}

.image-name {
  font-size: 11px;
  color: var(--mdui-color-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.image-size {
  font-size: 10px;
  color: var(--mdui-color-on-surface-variant);
}

@media (max-width: 600px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .image-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* 旧样式保留 */
.user-detail-dialog {
  max-width: 500px;
  width: 90vw;
}

.dialog-loading {
  text-align: center;
  padding: 48px 24px;
}

.user-detail-content {
  padding: 16px 0;
}

.user-detail-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.detail-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
}

.detail-avatar-placeholder {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--mdui-color-surface-container-highest);
  color: var(--mdui-color-on-surface-variant);
  font-size: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-detail-info h3 {
  margin: 0 0 4px 0;
  font-size: 18px;
  color: var(--mdui-color-on-surface);
}

.user-detail-info p {
  margin: 0;
  color: var(--mdui-color-on-surface-variant);
  font-size: 14px;
}

.user-email {
  font-size: 12px !important;
  color: var(--mdui-color-primary) !important;
}

.detail-section {
  padding: 16px 0;
}

.detail-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: var(--mdui-color-on-surface-variant);
}

.detail-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.detail-stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  background: var(--mdui-color-surface-container);
  border-radius: 8px;
}

.detail-stat-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--mdui-color-primary);
}

.detail-stat-label {
  font-size: 11px;
  color: var(--mdui-color-on-surface-variant);
  margin-top: 2px;
}

.empty-shares {
  text-align: center;
  padding: 24px;
  color: var(--mdui-color-on-surface-variant);
}

.detail-shares-list {
  max-height: 300px;
  overflow-y: auto;
}

.detail-share-item {
  --mdui-list-item-leading-space: 0;
  --mdui-list-item-trailing-space: 0;
}

.share-desc {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.share-content-text {
  font-size: 13px;
  color: var(--mdui-color-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 600px) {
  .stats-summary {
    grid-template-columns: repeat(2, 1fr);
  }

  .detail-stats {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
