<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  show: boolean
  baseUrl: string
}>()

const emit = defineEmits(['close'])

// API 基础地址
const API_BASE = import.meta.env.VITE_API_URL || 'https://ji-clipboard-worker.olojiang.workers.dev'

// 分享列表状态
const myShares = ref<Array<{
  code: string
  content: string
  type: string
  createdAt: number
  expiresAt: number
}>>([])
const mySharesLoading = ref(false)
const mySharesError = ref('')

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

// 复制分享链接
function copyShareLink(code: string) {
  const shareLink = `${props.baseUrl}/view.html?code=${code}`
  navigator.clipboard.writeText(shareLink).then(() => {
    alert('分享链接已复制！')
  }).catch(() => {
    const input = document.createElement('input')
    input.value = shareLink
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    alert('分享链接已复制！')
  })
}

// 打开分享
function openShare(code: string) {
  window.open(`./view.html?code=${code}`, '_blank')
}

// 关闭弹窗
function close() {
  myShares.value = []
  mySharesError.value = ''
  emit('close')
}

// 打开时加载数据
function onOpen() {
  fetchMyShares()
}

defineExpose({ onOpen })
</script>

<template>
  <div v-if="show" class="fullscreen-overlay">
    <div class="overlay-header">
      <mdui-top-app-bar class="overlay-app-bar">
        <mdui-button-icon icon="arrow_back" @click="close"></mdui-button-icon>
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
</template>

<style scoped>
.fullscreen-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #FEF7FF;
  z-index: 9999;
  display: flex;
  flex-direction: column;
}

.overlay-header {
  flex-shrink: 0;
  background: #FEF7FF;
  border-bottom: 1px solid #E7E0EC;
}

.overlay-app-bar {
  position: relative;
}

.overlay-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #FEF7FF;
}

.loading-state, .error-state, .empty-state {
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

.shares-list {
  padding: 0;
  background: white;
  border-radius: 12px;
}
</style>