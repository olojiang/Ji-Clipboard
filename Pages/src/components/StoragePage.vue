<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'

const emit = defineEmits(['showToast', 'back'])

const API_BASE = import.meta.env.VITE_API_URL || 'https://ji-clipboard-worker.olojiang.workers.dev'

// 存储信息
const storageInfo = ref<{
  totalSize: number
  maxSize: number
  images: Array<{
    id: string
    url: string
    filename: string
    size: number
    createdAt: number
  }>
  files: Array<{
    id: string
    url: string
    originalName: string
    size: number
    type: string
    createdAt: number
  }>
} | null>(null)
const isLoading = ref(false)
const error = ref('')

// 计算已用空间百分比
const storagePercent = computed(() => {
  if (!storageInfo.value) return 0
  return Math.round((storageInfo.value.totalSize / storageInfo.value.maxSize) * 100)
})

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
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

// 获取存储信息
async function fetchStorageInfo() {
  isLoading.value = true
  error.value = ''

  try {
    const sessionId = localStorage.getItem('session_id')
    
    // 检查是否登录
    if (!sessionId) {
      error.value = '请先登录后查看存储管理'
      return
    }
    
    let url = `${API_BASE}/api/storage`
    url += `?session=${sessionId}`

    const response = await fetch(url, {
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    })

    if (!response.ok) {
      if (response.status === 401) {
        error.value = '登录已过期，请重新登录'
      } else {
        error.value = '获取存储信息失败'
      }
      return
    }

    const data = await response.json()
    storageInfo.value = { ...data }
    await nextTick()
  } catch (err: any) {
    error.value = err.message || '获取存储信息失败'
    console.error('获取存储信息失败:', err)
  } finally {
    isLoading.value = false
  }
}

// 删除图片
async function deleteImage(imageId: string) {
  if (!confirm('确定要删除这张图片吗？')) {
    return
  }

  try {
    const sessionId = localStorage.getItem('session_id')
    let url = `${API_BASE}/api/images/${imageId}`
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

    emit('showToast', '图片已删除')
    await fetchStorageInfo()
  } catch (err: any) {
    emit('showToast', '删除失败: ' + err.message)
    console.error('删除图片失败:', err)
  }
}

// 复制图片链接
function copyImageUrl(url: string) {
  navigator.clipboard.writeText(url).then(() => {
    emit('showToast', '链接已复制')
  }).catch(() => {
    emit('showToast', '复制失败')
  })
}

// 下载文件
function downloadFile(url: string) {
  window.open(url, '_blank')
}

// 删除文件
async function deleteFile(fileId: string) {
  if (!confirm('确定要删除这个文件吗？')) {
    return
  }

  try {
    const sessionId = localStorage.getItem('session_id')
    let url = `${API_BASE}/api/files/${fileId}`
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

    emit('showToast', '文件已删除')
    await fetchStorageInfo()
  } catch (err: any) {
    emit('showToast', '删除失败: ' + err.message)
    console.error('删除文件失败:', err)
  }
}

// 页面加载时获取数据
onMounted(() => {
  fetchStorageInfo()
})
</script>

<template>
  <div class="storage-page">
    <!-- 页面标题 -->
    <div class="page-header">
      <mdui-button-icon icon="arrow_back" @click="$emit('back')"></mdui-button-icon>
      <h2 class="page-title">存储管理</h2>
      <mdui-button variant="text" @click="fetchStorageInfo" :loading="isLoading">
        <mdui-icon slot="icon" name="refresh"></mdui-icon>
        刷新
      </mdui-button>
    </div>

    <!-- 加载中 -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>正在加载...</p>
    </div>

    <!-- 错误提示 -->
    <div v-else-if="error" class="error-state">
      <mdui-icon name="error_outline" style="font-size: 48px; color: var(--mdui-color-error);"></mdui-icon>
      <p>{{ error }}</p>
      <mdui-button variant="filled" @click="fetchStorageInfo">重试</mdui-button>
    </div>

    <!-- 存储概览 -->
    <template v-else-if="storageInfo">
      <mdui-card class="storage-overview">
        <div class="storage-stats">
          <div class="storage-chart">
            <div class="chart-ring" :style="{ '--percent': storagePercent }">
              <div class="chart-inner">
                <span class="chart-percent">{{ storagePercent }}%</span>
                <span class="chart-label">已使用</span>
              </div>
            </div>
          </div>
          <div class="storage-details">
            <div class="detail-item">
              <span class="detail-label">总空间</span>
              <span class="detail-value">{{ formatFileSize(storageInfo.maxSize || 0) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">已用空间</span>
              <span class="detail-value" :class="{ 'text-error': storagePercent >= 90 }">
                {{ formatFileSize(storageInfo.totalSize || 0) }}
              </span>
            </div>
            <div class="detail-item">
              <span class="detail-label">剩余空间</span>
              <span class="detail-value">{{ formatFileSize((storageInfo.maxSize || 0) - (storageInfo.totalSize || 0)) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">图片数量</span>
              <span class="detail-value">{{ (storageInfo.images || []).length }} 张</span>
            </div>
          </div>
        </div>

        <div v-if="storagePercent >= 90" class="storage-warning">
          <mdui-icon name="warning"></mdui-icon>
          <span>存储空间即将用完，建议删除一些不需要的图片</span>
        </div>
      </mdui-card>

      <!-- 图片列表 -->
      <div v-if="storageInfo.images && storageInfo.images.length > 0" class="images-section">
        <h3 class="section-title">我的图片 ({{ storageInfo.images.length }})</h3>
        
        <div class="images-grid">
          <div v-for="image in storageInfo.images" :key="image.id" class="image-card">
            <div class="image-wrapper">
              <img :src="image.url" :alt="image.filename" loading="lazy">
            </div>
            
            <div class="image-info">
              <div class="image-meta">
                <span class="image-size">{{ formatFileSize(image.size) }}</span>
                <span class="image-date">{{ formatDate(image.createdAt) }}</span>
              </div>
              
              <div class="image-actions">
                <mdui-button-icon
                  icon="content_copy"
                  title="复制链接"
                  @click="copyImageUrl(image.url)"
                ></mdui-button-icon>
                <mdui-button-icon
                  icon="delete"
                  title="删除"
                  style="color: var(--mdui-color-error);"
                  @click="deleteImage(image.id)"
                ></mdui-button-icon>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 文件列表 -->
      <div v-if="storageInfo.files && storageInfo.files.length > 0" class="files-section">
        <h3 class="section-title">我的文件 ({{ storageInfo.files.length }})</h3>
        
        <div class="files-list">
          <div v-for="file in storageInfo.files" :key="file.id" class="file-card">
            <mdui-icon name="insert_drive_file" style="font-size: 40px; color: var(--mdui-color-primary);"></mdui-icon>
            
            <div class="file-info">
              <span class="file-name">{{ file.originalName }}</span>
              <div class="file-meta">
                <span class="file-size">{{ formatFileSize(file.size) }}</span>
                <span class="file-date">{{ formatDate(file.createdAt) }}</span>
              </div>
            </div>
            
            <div class="file-actions">
              <mdui-button-icon
                icon="download"
                title="下载"
                @click="downloadFile(file.url)"
              ></mdui-button-icon>
              <mdui-button-icon
                icon="delete"
                title="删除"
                style="color: var(--mdui-color-error);"
                @click="deleteFile(file.id)"
              ></mdui-button-icon>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="(!storageInfo.images || storageInfo.images.length === 0) && (!storageInfo.files || storageInfo.files.length === 0)" class="empty-state">
        <mdui-icon name="cloud_upload" style="font-size: 64px; opacity: 0.5;"></mdui-icon>
        <p>暂无上传内容</p>
        <p style="font-size: 14px; color: var(--mdui-color-on-surface-variant);">
          在添加剪贴板时选择"图片"或"文件"类型即可上传
        </p>
      </div>
    </template>

    <!-- 默认状态（storageInfo 为 null 且没有错误） -->
    <div v-else class="loading-state">
      <div class="spinner"></div>
      <p>正在加载存储信息...</p>
    </div>
  </div>
</template>

<style scoped>
.storage-page {
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

.storage-overview {
  padding: 16px;
  margin-bottom: 16px;
  width: 100%;
  box-sizing: border-box;
}

.storage-stats {
  display: flex;
  gap: 16px;
  align-items: center;
}

.storage-chart {
  flex-shrink: 0;
}

.chart-ring {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: conic-gradient(
    var(--mdui-color-primary) calc(var(--percent) * 1%),
    var(--mdui-color-surface-container-highest) calc(var(--percent) * 1%)
  );
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.chart-inner {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: var(--mdui-color-surface);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.chart-percent {
  font-size: 16px;
  font-weight: 600;
  color: var(--mdui-color-on-surface);
}

.chart-label {
  font-size: 10px;
  color: var(--mdui-color-on-surface-variant);
}

.storage-details {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px;
  background: var(--mdui-color-surface-container);
  border-radius: 8px;
}

.detail-item:last-child {
  border-bottom: none;
}

.detail-label {
  font-size: 12px;
  color: var(--mdui-color-on-surface-variant);
}

.detail-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--mdui-color-on-surface);
}

.text-error {
  color: var(--mdui-color-error);
}

.storage-warning {
  margin-top: 12px;
  padding: 8px 12px;
  background: var(--mdui-color-error-container);
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--mdui-color-on-error-container);
  font-size: 12px;
}

.images-section {
  margin-top: 16px;
}

.section-title {
  margin: 0 0 16px 0;
  padding: 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--mdui-color-on-surface);
}

.images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
}

.image-card {
  background: var(--mdui-color-surface);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.image-wrapper {
  width: 100%;
  height: 160px;
  overflow: hidden;
}

.image-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
}

.image-wrapper img:hover {
  transform: scale(1.05);
}

.image-info {
  padding: 12px;
}

.image-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.image-size {
  font-size: 14px;
  font-weight: 500;
  color: var(--mdui-color-on-surface);
}

.image-date {
  font-size: 12px;
  color: var(--mdui-color-on-surface-variant);
}

.image-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* 文件列表样式 */
.files-section {
  margin-top: 24px;
}

.files-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.file-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--mdui-color-surface);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.file-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--mdui-color-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--mdui-color-on-surface-variant);
}

.file-actions {
  display: flex;
  gap: 8px;
}

@media (max-width: 600px) {
  .storage-stats {
    flex-direction: row;
    align-items: center;
  }
  
  .storage-details {
    width: 100%;
    grid-template-columns: repeat(2, 1fr);
  }
  
  .images-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .file-card {
    padding: 12px;
  }
}
</style>