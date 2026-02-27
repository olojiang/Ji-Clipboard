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
          >
            <div slot="headline" class="user-info">
              <span>用户 {{ user.userId?.substring(0, 8) }}...</span>
            </div>
            <div slot="description" class="user-stats">
              <mdui-chip size="small" variant="outlined">{{ formatFileSize(user.totalSize || 0) }}</mdui-chip>
              <mdui-chip size="small" variant="outlined">{{ user.imagesCount || 0 }} 张图片</mdui-chip>
              <mdui-chip size="small" variant="outlined">{{ user.filesCount || 0 }} 个文件</mdui-chip>
            </div>
          </mdui-list-item>
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
  margin-bottom: 16px;
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

.user-info {
  font-weight: 500;
}

.user-stats {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

@media (max-width: 600px) {
  .stats-summary {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
