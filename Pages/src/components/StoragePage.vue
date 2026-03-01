<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'

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
  console.log('[StoragePage] fetchStorageInfo 开始')
  isLoading.value = true
  error.value = ''

  try {
    const sessionId = localStorage.getItem('session_id')
    
    // 检查是否登录
    if (!sessionId) {
      error.value = '请先登录后查看存储管理'
      console.log('[StoragePage] 未登录，设置错误信息')
      return
    }
    
    let url = `${API_BASE}/api/storage`
    url += `?session=${sessionId}`

    console.log('[StoragePage] 请求 URL:', url)

    const response = await fetch(url, {
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    })

    console.log('[StoragePage] 响应状态:', response.status)

    if (!response.ok) {
      if (response.status === 401) {
        error.value = '登录已过期，请重新登录'
      } else {
        error.value = '获取存储信息失败'
      }
      console.log('[StoragePage] 响应错误，设置错误信息:', error.value)
      return
    }

    const data = await response.json()
    console.log('[StoragePage] 存储数据:', data)
    console.log('[StoragePage] 图片数量:', data.images?.length)
    console.log('[StoragePage] 文件数量:', data.files?.length)
    
    // 确保数据赋值是响应式的
    storageInfo.value = { ...data }
    
    console.log('[StoragePage] storageInfo 已设置:', storageInfo.value)
    console.log('[StoragePage] storageInfo.images:', storageInfo.value?.images)
    console.log('[StoragePage] storageInfo.files:', storageInfo.value?.files)
    
    // 强制 DOM 更新
    await nextTick()
    console.log('[StoragePage] nextTick 完成，DOM 应该已更新')
  } catch (err: any) {
    error.value = err.message || '获取存储信息失败'
    console.error('[StoragePage] 获取存储信息失败:', err)
  } finally {
    isLoading.value = false
    console.log('[StoragePage] isLoading 设置为 false')
    console.log('[StoragePage] 最终状态 - isLoading:', isLoading.value, 'error:', error.value, 'storageInfo:', storageInfo.value)
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
  console.log('[StoragePage] ========== 组件挂载 ==========')
  console.log('[StoragePage] 初始状态 - isLoading:', isLoading.value, 'error:', error.value, 'storageInfo:', storageInfo.value)
  fetchStorageInfo()
})

onUnmounted(() => {
  console.log('[StoragePage] ========== 组件卸载 ==========')
})
</script>

<template>
  <div class="storage-page" style="background: blue; min-height: 500px; padding: 20px;">
    <h1 style="color: red; font-size: 24px; background: yellow; padding: 20px;">存储管理页面 - 测试</h1>
    
    <div style="padding: 10px; background: #f0f0f0; margin: 10px 0;">
      <p><strong>状态信息：</strong></p>
      <p>isLoading: {{ isLoading }}</p>
      <p>error: {{ error || '无' }}</p>
      <p>storageInfo: {{ storageInfo ? '有数据' : 'null' }}</p>
      <p v-if="storageInfo">图片数: {{ storageInfo.images?.length }}</p>
      <p v-if="storageInfo">文件数: {{ storageInfo.files?.length }}</p>
    </div>

    <!-- 加载中 -->
    <div v-if="isLoading" style="padding: 20px; background: yellow;">
      <p>正在加载...</p>
    </div>

    <!-- 错误提示 -->
    <div v-else-if="error" style="padding: 20px; background: red; color: white;">
      <p>错误: {{ error }}</p>
    </div>

    <!-- 有数据 -->
    <div v-else-if="storageInfo" style="padding: 20px; background: green; color: white;">
      <p>数据已加载！</p>
      <p>总大小: {{ formatFileSize(storageInfo.totalSize) }}</p>
      <p>图片数量: {{ storageInfo.images?.length }}</p>
      
      <!-- 图片列表 -->
      <div v-if="storageInfo.images && storageInfo.images.length > 0" style="margin-top: 20px;">
        <h3>图片列表</h3>
        <div v-for="image in storageInfo.images" :key="image.id" style="margin: 10px 0; padding: 10px; background: rgba(255,255,255,0.2);">
          <p>ID: {{ image.id }}</p>
          <p>文件名: {{ image.filename }}</p>
          <p>大小: {{ formatFileSize(image.size) }}</p>
        </div>
      </div>
    </div>

    <!-- 默认状态 -->
    <div v-else style="padding: 20px; background: orange;">
      <p>等待数据...</p>
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
</style>