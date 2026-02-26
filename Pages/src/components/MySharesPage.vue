<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps<{
  baseUrl: string
}>()

const emit = defineEmits(['close'])

// API 基础地址
const API_BASE = import.meta.env.VITE_API_URL || 'https://ji-clipboard-worker.olojiang.workers.dev'

// 分享列表状态
const myShares = ref<Array<{
  id: string
  content: string
  visibility: string
  createdAt: number
  expiresAt: number
}>>([])
const mySharesLoading = ref(false)
const mySharesError = ref('')

// 页面加载时获取数据
onMounted(() => {
  fetchMyShares()
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

// 获取权限文本
function getVisibilityText(visibility: string): string {
  const map: Record<string, string> = {
    'public': '公开',
    'authenticated': '登录用户',
    'private': '私密'
  }
  return map[visibility] || visibility
}

// 获取我的剪贴板分享列表
async function fetchMyShares() {
  mySharesLoading.value = true
  mySharesError.value = ''

  try {
    const sessionId = localStorage.getItem('session_id')
    let url = `${API_BASE}/api/shares`
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

// 删除分享
async function deleteShare(shareId: string) {
  if (!confirm('确定要删除这个分享吗？')) {
    return
  }

  try {
    const sessionId = localStorage.getItem('session_id')
    let url = `${API_BASE}/api/shares/${shareId}`
    if (sessionId) {
      url += `?session=${sessionId}`
    }

    const response = await fetch(url, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // 重新获取列表
    await fetchMyShares()
  } catch (error) {
    console.error('删除分享失败:', error)
    alert('删除分享失败，请稍后重试')
  }
}

// 复制分享链接
function copyShareLink(shareId: string) {
  const shareLink = `${props.baseUrl}/?share=${shareId}`
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
function openShare(shareId: string) {
  window.open(`./?share=${shareId}`, '_blank')
}
</script>

<template>
  <div class="my-shares-page">
    <!-- 顶部导航栏 -->
    <mdui-top-app-bar class="app-bar">
      <mdui-button-icon icon="arrow_back" @click="$emit('close')"></mdui-button-icon>
      <mdui-top-app-bar-title>我的分享</mdui-top-app-bar-title>
    </mdui-top-app-bar>

    <!-- 主内容区 -->
    <main class="main-content">
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

      <mdui-card v-else class="shares-card">
        <mdui-list class="shares-list">
          <mdui-list-item
            v-for="share in myShares"
            :key="share.id"
            :description="`${formatDate(share.createdAt)} · 过期: ${formatDate(share.expiresAt)} · ${getVisibilityText(share.visibility)}`"
            icon="share"
          >
            <div slot="headline" class="share-headline">
              <span class="share-code">分享码: {{ share.id }}</span>
              <span class="share-content-preview">{{ share.content }}</span>
            </div>
            <div slot="end" style="display: flex; gap: 8px;">
              <mdui-button-icon
                icon="content_copy"
                @click="copyShareLink(share.id)"
                title="复制链接"
              ></mdui-button-icon>
              <mdui-button-icon
                icon="open_in_new"
                @click="openShare(share.id)"
                title="查看"
              ></mdui-button-icon>
              <mdui-button-icon
                icon="delete"
                @click="deleteShare(share.id)"
                title="删除"
                style="color: var(--mdui-color-error);"
              ></mdui-button-icon>
            </div>
          </mdui-list-item>
        </mdui-list>
      </mdui-card>
    </main>
  </div>
</template>

<style scoped>
.my-shares-page {
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

.shares-card {
  padding: 0;
}

.shares-list {
  padding: 0;
}

.share-headline {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.share-code {
  font-weight: 600;
  font-family: 'SF Mono', Monaco, monospace;
}

.share-content-preview {
  font-size: 12px;
  color: var(--mdui-color-on-surface-variant);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}
</style>