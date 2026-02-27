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

    console.log('开始获取存储统计:', url)
    
    const response = await fetch(url, {
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    })

    console.log('存储统计响应状态:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('存储统计响应错误:', errorText)
      throw new Error(`获取存储统计失败: ${response.status}`)
    }

    const data = await response.json()
    console.log('存储统计数据:', JSON.stringify(data, null, 2))
    
    // 验证数据结构
    if (!data || typeof data !== 'object') {
      throw new Error('返回数据格式错误: 不是对象')
    }
    
    if (!Array.isArray(data.users)) {
      console.warn('users 字段不是数组:', data.users)
      data.users = []
    }
    
    if (!data.summary || typeof data.summary !== 'object') {
      console.warn('summary 字段不是对象:', data.summary)
      data.summary = {
        totalUsers: 0,
        totalSize: 0,
        totalImages: 0,
        totalFiles: 0
      }
    }
    
    // 确保所有数字字段都是数字
    data.summary.totalUsers = Number(data.summary.totalUsers) || 0
    data.summary.totalSize = Number(data.summary.totalSize) || 0
    data.summary.totalImages = Number(data.summary.totalImages) || 0
    data.summary.totalFiles = Number(data.summary.totalFiles) || 0
    
    // 处理 users 数组中的每个用户
    data.users = data.users.map((user: any, index: number) => {
      try {
        return {
          userId: String(user.userId || ''),
          totalSize: Number(user.totalSize) || 0,
          imagesCount: Number(user.imagesCount) || 0,
          filesCount: Number(user.filesCount) || 0
        }
      } catch (e) {
        console.error(`处理第 ${index} 个用户数据失败:`, user, e)
        return {
          userId: 'unknown',
          totalSize: 0,
          imagesCount: 0,
          filesCount: 0
        }
      }
    })
    
    console.log('处理后的数据:', JSON.stringify(data, null, 2))
    
    // 使用 Object.assign 来更新响应式对象
    storageStats.value = { ...data }
    
    console.log('storageStats 已更新:', storageStats.value)
  } catch (error: any) {
    console.error('获取存储统计失败:', error)
    console.error('错误堆栈:', error.stack)
    emit('showToast', '获取存储统计失败: ' + error.message)
    storageStats.value = null
  } finally {
    storageLoading.value = false
  }
}

// 切换标签
function switchTab(tab: string) {
  console.log('切换标签:', tab)
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
      <button
        class="tab-button"
        :class="{ active: currentTab === 'shares' }"
        @click="switchTab('shares')"
      >
        所有分享
      </button>
      <button
        class="tab-button"
        :class="{ active: currentTab === 'storage' }"
        @click="switchTab('storage')"
      >
        存储统计
      </button>
    </div>

    <!-- 分享列表 -->
    <div v-if="currentTab === 'shares'">
      <div class="content-card">
        <div class="card-header">
          <span class="card-title">所有分享 ({{ shares.length }})</span>
          <button class="refresh-btn" @click="fetchAllShares" :disabled="sharesLoading">
            {{ sharesLoading ? '加载中...' : '刷新' }}
          </button>
        </div>

        <div v-if="sharesLoading" class="loading-state">
          <p>正在加载...</p>
        </div>

        <div v-else-if="shares.length === 0" class="empty-state">
          <p>暂无分享</p>
        </div>

        <div v-else class="shares-list">
          <div
            v-for="share in shares"
            :key="share.id"
            class="share-item"
          >
            <div class="share-content">
              <div class="share-header">
                <span class="share-id">{{ share.id }}</span>
                <span class="share-owner">@{{ share.ownerLogin }}</span>
                <span class="share-visibility">{{ getVisibilityText(share.visibility) }}</span>
              </div>
              <div class="share-text">{{ share.content }}</div>
              <div class="share-date">{{ formatDate(share.createdAt) }}</div>
            </div>
            <button class="delete-btn" @click="deleteShare(share.id)">删除</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 存储统计 -->
    <div v-else-if="currentTab === 'storage'">
      <div v-if="storageStats" class="content-card">
        <div class="card-header">
          <span class="card-title">存储概览</span>
          <button class="refresh-btn" @click="fetchStorageStats" :disabled="storageLoading">
            {{ storageLoading ? '加载中...' : '刷新' }}
          </button>
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
      </div>

      <div v-if="storageStats?.users" class="content-card">
        <div class="card-header">
          <span class="card-title">用户存储详情 ({{ storageStats.users.length }})</span>
        </div>

        <div v-if="storageLoading" class="loading-state">
          <p>正在加载...</p>
        </div>

        <div v-else class="users-list">
          <div
            v-for="user in storageStats.users"
            :key="user.userId"
            class="user-item"
          >
            <div class="user-info">
              <span class="user-id">用户 {{ user.userId?.substring(0, 8) }}...</span>
              <div class="user-stats">
                <span>{{ formatFileSize(user.totalSize || 0) }}</span>
                <span>{{ user.imagesCount || 0 }} 张图片</span>
                <span>{{ user.filesCount || 0 }} 个文件</span>
              </div>
            </div>
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

.tab-button {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background: var(--mdui-color-surface-container);
  color: var(--mdui-color-on-surface);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-button.active {
  background: var(--mdui-color-primary-container);
  color: var(--mdui-color-on-primary-container);
}

.content-card {
  background: var(--mdui-color-surface);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--mdui-color-on-surface-variant);
}

.refresh-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  background: var(--mdui-color-primary);
  color: white;
  font-size: 12px;
  cursor: pointer;
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-state, .empty-state {
  text-align: center;
  padding: 48px 24px;
  color: var(--mdui-color-on-surface-variant);
}

.shares-list, .users-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.share-item {
  display: flex;
  align-items: flex-start;
  padding: 12px;
  background: var(--mdui-color-surface-container);
  border-radius: 8px;
  gap: 12px;
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

.share-id {
  font-family: monospace;
  font-size: 12px;
  padding: 2px 6px;
  background: var(--mdui-color-surface-container-highest);
  border-radius: 4px;
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

.delete-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  background: var(--mdui-color-error);
  color: white;
  font-size: 12px;
  cursor: pointer;
}

.stats-summary {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
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
  padding: 12px;
  background: var(--mdui-color-surface-container);
  border-radius: 8px;
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
