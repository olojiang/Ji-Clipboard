<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

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
  type?: string
  visibility: string
  createdAt: number
  expiresAt: number
  itemCount?: number
  items?: Array<{ type: string; content: string }>
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

// 解析分享内容为项目列表
function parseShareContent(content: string): Array<{ type: string; content: string }> {
  if (!content) return []
  
  // 检查是否是批量分享（包含分隔符 ---）
  if (!content.includes('\n---\n') && !content.includes('---')) {
    // 单个分享，检测类型
    return [{ type: detectType(content), content }]
  }

  // 批量分享，按分隔符分割
  const separator = content.includes('\n---\n') ? '\n---\n' : '---'
  const items = content.split(separator)
  
  return items.map(item => {
    const trimmed = item.trim()
    if (!trimmed) return null
    return { type: detectType(trimmed), content: trimmed }
  }).filter(Boolean) as Array<{ type: string; content: string }>
}

// 检测内容类型
function detectType(content: string): string {
  // 检查是否是图片格式
  if (content.startsWith('[') && content.includes('http') && content.includes('ji-clipboard')) {
    return 'image'
  }
  // 检查是否是文件格式
  if ((content.includes('filename') || content.includes('"size"') || content.includes('originalName')) && content.startsWith('{')) {
    return 'file'
  }
  // 默认为文本
  return 'text'
}

// 获取文本内容的简短显示
function getTextPreview(content: string, maxLength: number = 20): string {
  // 移除 JSON 标记等
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
  // 截取前N个字符
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
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
    console.log('[fetchMyShares] 获取到的数据:', data)
    // 处理分享数据，解析内容
    myShares.value = (data.shares || []).map((share: any) => {
      console.log('[fetchMyShares] 处理分享:', share.id, 'items:', share.items, 'content:', share.content?.substring(0, 50))
      // 如果后端已经返回了 items 数组（新格式），直接使用
      if (share.items && share.items.length > 0) {
        return {
          ...share,
          itemCount: share.items.length
        }
      }
      // 否则从 content 解析（旧格式兼容）
      const items = parseShareContent(share.content)
      console.log('[fetchMyShares] 从 content 解析的 items:', items)
      return {
        ...share,
        items,
        itemCount: items.length
      }
    })
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

    await fetchMyShares()
    emit('showToast', '分享已删除')
  } catch (error) {
    console.error('删除分享失败:', error)
    emit('showToast', '删除分享失败')
  }
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
  const shareLink = `${props.baseUrl}/?share=${shareId}`
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
  <div class="my-shares-page">
    <!-- 主内容区 -->
    <main class="main-content">
      <!-- 我的分享列表 -->
      <mdui-card class="shares-list-card">
        <div class="shares-list-header">
          <span class="shares-list-title">我的分享</span>
          <mdui-button variant="text" @click="fetchMyShares" :loading="mySharesLoading">
            <mdui-icon slot="icon" name="refresh"></mdui-icon>
            刷新
          </mdui-button>
        </div>

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
          <div
            v-for="share in myShares"
            :key="share.id"
            class="share-item"
          >
            <div class="share-content">
              <!-- 分享码 -->
              <div class="share-code-row">
                <mdui-chip icon="tag" variant="outlined" class="share-code-chip" @click="copyShareCode(share.id)">
                  #{{ share.id }}
                </mdui-chip>
              </div>
              
              <!-- 内容概要 - 文本直接显示，图片和文件用 chip -->
              <div class="share-items-row">
                <template v-for="(item, index) in share.items" :key="index">
                  <!-- 文本内容 - 直接显示 -->
                  <span v-if="item.type === 'text'" class="text-content">
                    {{ getTextPreview(item.content, 20) }}
                  </span>
                  
                  <!-- 图片 -->
                  <mdui-chip v-else-if="item.type === 'image'" size="small" variant="outlined" class="content-chip image-chip">
                    <mdui-icon slot="icon" name="image"></mdui-icon>
                    图片
                  </mdui-chip>
                  
                  <!-- 文件 -->
                  <mdui-chip v-else-if="item.type === 'file'" size="small" variant="outlined" class="content-chip file-chip">
                    <mdui-icon slot="icon" name="insert_drive_file"></mdui-icon>
                    {{ getTextPreview(item.content, 10) }}
                  </mdui-chip>
                </template>
              </div>
              
              <!-- 元信息 -->
              <div class="share-meta">
                <span class="share-date">{{ formatDate(share.createdAt) }}</span>
                <mdui-chip size="small" variant="outlined" class="visibility-chip">
                  {{ getVisibilityText(share.visibility) }}
                </mdui-chip>
              </div>
            </div>
            
            <!-- 操作按钮 -->
            <div class="share-actions">
              <mdui-button-icon icon="content_copy" title="复制分享码" @click="copyShareCode(share.id)"></mdui-button-icon>
              <mdui-button-icon icon="link" title="复制链接" @click="copyShareLink(share.id)"></mdui-button-icon>
              <mdui-button-icon icon="open_in_new" title="打开分享" @click="openShare(share.id)"></mdui-button-icon>
              <mdui-button-icon icon="delete" title="删除" style="color: var(--mdui-color-error);" @click="deleteShare(share.id)"></mdui-button-icon>
            </div>
          </div>
        </mdui-list>
      </mdui-card>
    </main>
  </div>
</template>

<style scoped>
.my-shares-page {
  height: 100%;
  overflow-y: auto;
}

.main-content {
  padding: 0;
}

.shares-list-card {
  padding: 16px;
  width: 100%;
  box-sizing: border-box;
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

.share-code-row {
  display: flex;
  align-items: center;
}

.share-code-chip {
  font-family: 'SF Mono', Monaco, monospace;
  font-weight: 600;
  cursor: pointer;
}

.share-items-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.content-chip {
  max-width: 200px;
}

.text-content {
  font-size: 14px;
  color: var(--mdui-color-on-surface);
  margin-right: 8px;
}

.image-chip {
  --mdui-chip-outline-color: var(--mdui-color-tertiary-container);
  color: var(--mdui-color-tertiary);
}

.file-chip {
  --mdui-chip-outline-color: var(--mdui-color-secondary-container);
  color: var(--mdui-color-secondary);
}

.share-meta {
  display: flex;
  gap: 12px;
  align-items: center;
  font-size: 12px;
  color: var(--mdui-color-on-surface-variant);
}

.share-date {
  color: var(--mdui-color-on-surface-variant);
}

.visibility-chip {
  font-size: 11px;
}

.share-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}

.share-actions mdui-button-icon {
  --mdui-button-icon-size: 36px;
}
</style>
