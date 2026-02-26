<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps<{
  baseUrl: string
}>()

const emit = defineEmits(['showToast'])

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

// 详情弹窗状态
const showDetailDialog = ref(false)
const selectedShare = ref<{
  id: string
  content: string
  visibility: string
  createdAt: number
  expiresAt: number
} | null>(null)

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

// 获取第一行内容
function getFirstLine(content: string): string {
  return content.split('\n')[0] || content
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

// 打开详情弹窗
function openDetail(share: any) {
  selectedShare.value = share
  showDetailDialog.value = true
}

// 关闭详情弹窗
function closeDetail() {
  showDetailDialog.value = false
  selectedShare.value = null
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

    // 关闭弹窗并重新获取列表
    closeDetail()
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

// 复制内容
function copyContent(content: string) {
  navigator.clipboard.writeText(content).then(() => {
    alert('内容已复制！')
  }).catch(() => {
    const input = document.createElement('input')
    input.value = content
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    alert('内容已复制！')
  })
}

// 打开分享
function openShare(shareId: string) {
  window.open(`./?share=${shareId}`, '_blank')
}
</script>

<template>
  <div class="my-shares-page">
    <!-- 顶部标题 -->
    <div class="page-header">
      <h2 class="page-title">我的分享</h2>
      <mdui-button variant="text" @click="fetchMyShares" :loading="mySharesLoading">
        <mdui-icon slot="icon" name="refresh"></mdui-icon>
        刷新
      </mdui-button>
    </div>

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

      <!-- 分享列表 - 类似剪贴板样式 -->
      <mdui-card v-else class="shares-card">
        <div class="shares-list-header">
          <span class="shares-list-title">我的分享</span>
          <mdui-button variant="text" @click="fetchMyShares" :loading="mySharesLoading">
            <mdui-icon slot="icon" name="refresh"></mdui-icon>
            刷新
          </mdui-button>
        </div>

        <mdui-list class="shares-list">
          <div
            v-for="share in myShares"
            :key="share.id"
            class="share-item"
            @click="openDetail(share)"
          >
            <div class="share-content">
              <div class="share-text">{{ getFirstLine(share.content) }}</div>
              <div class="share-meta">
                <span class="share-date">{{ formatDate(share.createdAt) }}</span>
                <span class="share-visibility">{{ getVisibilityText(share.visibility) }}</span>
              </div>
            </div>
            <mdui-icon name="chevron_right" class="share-arrow"></mdui-icon>
          </div>
        </mdui-list>
      </mdui-card>
    </main>

    <!-- 详情弹窗 -->
    <mdui-dialog
      :open="showDetailDialog"
      @close="closeDetail"
      style="max-width: 600px; width: 90%; max-height: 80vh;"
    >
      <div slot="headline" style="font-size: 20px; font-weight: 600;">
        分享详情
      </div>

      <div v-if="selectedShare" style="padding: 16px 0;">
        <!-- 分享码 -->
        <div style="margin-bottom: 16px;">
          <div style="font-size: 12px; color: var(--mdui-color-on-surface-variant); margin-bottom: 4px;">
            分享码
          </div>
          <mdui-chip icon="share" variant="outlined" style="font-family: monospace; font-weight: 600;">
            {{ selectedShare.id }}
          </mdui-chip>
        </div>

        <!-- 内容 -->
        <div style="margin-bottom: 16px;">
          <div style="font-size: 12px; color: var(--mdui-color-on-surface-variant); margin-bottom: 8px;">
            分享内容
          </div>
          <div style="
            padding: 12px 16px;
            background: var(--mdui-color-surface-container);
            border-radius: 8px;
            font-size: 14px;
            line-height: 1.5;
            max-height: 200px;
            overflow-y: auto;
            word-break: break-word;
            white-space: pre-wrap;
          ">
            {{ selectedShare.content }}
          </div>
        </div>

        <!-- 信息 -->
        <div style="margin-bottom: 24px; display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; font-size: 14px;">
            <span style="color: var(--mdui-color-on-surface-variant);">权限</span>
            <span>{{ getVisibilityText(selectedShare.visibility) }}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 14px;">
            <span style="color: var(--mdui-color-on-surface-variant);">创建时间</span>
            <span>{{ formatDate(selectedShare.createdAt) }}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 14px;">
            <span style="color: var(--mdui-color-on-surface-variant);">过期时间</span>
            <span>{{ formatDate(selectedShare.expiresAt) }}</span>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <mdui-button variant="filled" @click="copyContent(selectedShare.content)" style="flex: 1;">
            <mdui-icon slot="icon" name="content_copy"></mdui-icon>
            复制内容
          </mdui-button>
          <mdui-button variant="outlined" @click="copyShareLink(selectedShare.id)" style="flex: 1;">
            <mdui-icon slot="icon" name="link"></mdui-icon>
            复制链接
          </mdui-button>
        </div>
      </div>

      <div slot="action">
        <mdui-button variant="text" @click="deleteShare(selectedShare!.id)" style="color: var(--mdui-color-error);">
          <mdui-icon slot="icon" name="delete"></mdui-icon>
          删除
        </mdui-button>
        <mdui-button variant="filled" @click="closeDetail">关闭</mdui-button>
      </div>
    </mdui-dialog>
  </div>
</template>

<style scoped>
.my-shares-page {
  height: 100%;
  overflow-y: auto;
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
  padding: 16px;
}

.shares-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding: 0 8px;
}

.shares-list-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--mdui-color-on-surface-variant);
  letter-spacing: 1px;
}

.shares-list {
  padding: 0;
}

.share-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--mdui-color-outline-variant);
  cursor: pointer;
  transition: background 0.2s;
}

.share-item:hover {
  background: var(--mdui-color-surface-container-highest);
}

.share-item:last-child {
  border-bottom: none;
}

.share-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.share-text {
  font-size: 16px;
  color: var(--mdui-color-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.5;
}

.share-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--mdui-color-on-surface-variant);
}

.share-date {
  color: var(--mdui-color-on-surface-variant);
}

.share-visibility {
  padding: 2px 8px;
  background: var(--mdui-color-primary-container);
  border-radius: 4px;
  color: var(--mdui-color-on-primary-container);
  font-size: 11px;
}

.share-arrow {
  color: var(--mdui-color-on-surface-variant);
  margin-left: 8px;
}
</style>