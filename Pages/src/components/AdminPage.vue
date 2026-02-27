<script setup lang="ts">
import { ref, onMounted } from 'vue'

const emit = defineEmits(['showToast'])

const API_BASE = import.meta.env.VITE_API_URL || 'https://ji-clipboard-worker.olojiang.workers.dev'

// 当前标签
const currentTab = ref('shares') // 'shares' | 'storage'

// 分享列表
const shares = ref<Array<{
  id: string
  content: string
  type: string
  visibility: string
  ownerId: number
  ownerLogin: string
  createdAt: number
  expiresAt: number
}>>([])
const sharesLoading = ref(false)

// 存储统计
const storageStats = ref<{
  users: Array<{
    userId: string
    totalSize: number
    imagesCount: number
    filesCount: number
  }>
  summary: {
    totalUsers: number
    totalSize: number
    totalImages: number
    totalFiles: number
  }
}> | null>(null)
const storageLoading = ref(false)

// 页面加载时获取数据
onMounted(() => {
  fetchAllShares()
  fetchStorageStats()
})

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

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
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

    storageStats.value = await response.json()
  } catch (error) {
    console.error('获取存储统计失败:', error)
    emit('showToast', '获取存储统计失败')
  } finally {
    storageLoading.value = false
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
        @click="currentTab = 'shares'"
        style="cursor: pointer;"
      >
        <mdui-icon slot="icon" name="share"></mdui-icon>
        所有分享
      </mdui-chip>
      <mdui-chip
        :selected="currentTab === 'storage'"
        @click="currentTab = 'storage'"
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
            <span class="stat-value">{{ storageStats.summary.totalUsers }}</span>
            <span class="stat-label">用户总数</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ formatFileSize(storageStats.summary.totalSize) }}</span>
            <span class="stat-label">总存储</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ storageStats.summary.totalImages }}</span>
            <span class="stat-label">图片总数</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ storageStats.summary.totalFiles }}</span>
            <span class="stat-label">文件总数</span>
          </div>
        </div>
      </mdui-card>

      <mdui-card v-if="storageStats" class="content-card">
        <div class="card-header">
          <span class="card-title">用户存储详情 ({{ storageStats.users.length }})</span>
        </div>

        <div v-if="storageLoading" class="loading-state">
          <div class="spinner"></div>
          <p>正在加载...</p>
        </div>

        <mdui-list v-else class="users-list">
          <div
            v-for="user in storageStats.users"
            :key="user.userId"
            class="user-item"
          >
            <div class="user-info">
              <span class="user-id">用户 {{ user.userId.substring(0, 8) }}...</span>
              <div class="user-stats">
                <span>{{ formatFileSize(user.totalSize) }}</span>
                <span>{{ user.imagesCount }} 张图片</span>
                <span>{{ user.filesCount }} 个文件</span>
              </div>
            </div>
          </div>
        </mdui-list>
      </mdui-card>
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
  padding: 16px;
  margin-bottom: 16px;
  width: 100%;
  box-sizing: border-box;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 0 8px;
}

.card-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--mdui-color-on-surface-variant);
  letter-spacing: 1px;
}

.loading-state, .empty-state {
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

.shares-list, .users-list {
  padding: 0;
}

.share-item {
  display: flex;
  align-items: flex-start;
  padding: 12px 16px;
  border-bottom: 1px solid var(--mdui-color-outline-variant);
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
  padding: 8px;
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
  font-size: 20px;
  font-weight: 600;
  color: var(--mdui-color-primary);
}

.stat-label {
  font-size: 12px;
  color: var(--mdui-color-on-surface-variant);
  margin-top: 4px;
}

.user-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--mdui-color-outline-variant);
}

.user-item:last-child {
  border-bottom: none;
}

.user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.user-id {
  font-size: 14px;
  font-weight: 500;
  color: var(--mdui-color-on-surface);
}

.user-stats {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--mdui-color-on-surface-variant);
}

@media (max-width: 600px) {
  .stats-summary {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
