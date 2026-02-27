<script setup lang="ts">
import { ref, onMounted } from 'vue'

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
  } catch (error) {
    console.error('删除分享失败:', error)
    emit('showToast', '删除分享失败')
  }
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
          >
            <div class="share-content">
              <div class="share-header">
                <mdui-chip icon="tag" variant="outlined" size="small" style="font-family: monospace;"
                  >{{ share.id }}</mdui-chip>
                <span class="share-owner">@{{ share.ownerLogin }}</span>
                <span class="share-visibility">{{ getVisibilityText(share.visibility) }}</span>
              </div>
              <div class="share-text">{{ share.content }}</div>
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
            <div slot="headline" class="user-info">
              <div class="user-name-row">
                <img v-if="user.userAvatar" :src="user.userAvatar" class="user-avatar" alt="avatar" />
                <mdui-icon v-else name="person" class="user-avatar-placeholder"></mdui-icon>
                <span class="user-login">@{{ user.userLogin }}</span>
              </div>
            </div>
            <div slot="description" class="user-stats">
              <mdui-chip size="small" variant="outlined">{{ formatFileSize(user.totalSize || 0) }}</mdui-chip>
              <mdui-chip size="small" variant="outlined">{{ user.imagesCount || 0 }} 张图片</mdui-chip>
              <mdui-chip size="small" variant="outlined">{{ user.filesCount || 0 }} 个文件</mdui-chip>
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
            <mdui-list>
              <mdui-list-item
                v-for="share in userDetail.shares"
                :key="share.id"
              >
                <div slot="headline">
                  <mdui-chip size="small" variant="outlined" style="font-family: monospace;"
                    >{{ share.id }}</mdui-chip>
                  <span class="share-visibility-tag">{{ getVisibilityText(share.visibility) }}</span>
                </div>
                <div slot="description" class="share-description">
                  <span class="share-content-preview">{{ share.content?.substring(0, 100) }}{{ share.content?.length > 100 ? '...' : '' }}</span>
                  <span class="share-time">{{ formatDate(share.createdAt) }}</span>
                </div>
              </mdui-list-item>
            </mdui-list>
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
                  <img :src="image.url" :alt="image.name || image.filename" @error="$event.target.src = '/placeholder-image.png'" />
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
