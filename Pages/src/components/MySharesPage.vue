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

// 长按菜单状态
const showContextMenu = ref(false)
const contextMenuShare = ref<any>(null)
const contextMenuPosition = ref({ x: 0, y: 0 })
const longPressTimer = ref<number | null>(null)
const LONG_PRESS_DURATION = 800

// 详情弹窗状态
const showDetailDialog = ref(false)
const selectedShare = ref<any>(null)

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

// 打开详情弹窗
function openDetail(share: any) {
  // 如果是长按触发的，不打开详情
  if (showContextMenu.value) return
  selectedShare.value = share
  showDetailDialog.value = true
}

// 关闭详情弹窗
function closeDetail() {
  showDetailDialog.value = false
  setTimeout(() => {
    selectedShare.value = null
  }, 300)
}

// 长按处理
function handleLongPress(event: TouchEvent | MouseEvent, share: any) {
  event.preventDefault()
  console.log('[LongPress] 显示菜单', share)
  contextMenuShare.value = share

  // 获取触摸/点击位置
  if ('touches' in event && event.touches.length > 0) {
    contextMenuPosition.value = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY
    }
  } else if ('clientX' in event) {
    contextMenuPosition.value = {
      x: event.clientX,
      y: event.clientY
    }
  }

  showContextMenu.value = true
}

// 关闭菜单
function closeContextMenu() {
  showContextMenu.value = false
  contextMenuShare.value = null
}

// 处理触摸开始
let touchStartTime = 0
let touchStartX = 0
let touchStartY = 0
const TOUCH_MOVE_THRESHOLD = 10

function handleTouchStart(event: TouchEvent, share: any) {
  const touch = event.touches[0]
  touchStartTime = Date.now()
  touchStartX = touch.clientX
  touchStartY = touch.clientY

  longPressTimer.value = window.setTimeout(() => {
    handleLongPress(event, share)
    longPressTimer.value = null
  }, LONG_PRESS_DURATION)
}

function handleTouchMove(event: TouchEvent) {
  if (!longPressTimer.value) return

  const touch = event.touches[0]
  const deltaX = Math.abs(touch.clientX - touchStartX)
  const deltaY = Math.abs(touch.clientY - touchStartY)

  if (deltaX > TOUCH_MOVE_THRESHOLD || deltaY > TOUCH_MOVE_THRESHOLD) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }
}

function handleTouchEnd() {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }
}

// 执行菜单操作
function menuAction(action: string) {
  if (!contextMenuShare.value) return
  
  const shareId = contextMenuShare.value.id
  closeContextMenu()
  
  switch (action) {
    case 'copyCode':
      copyShareCode(shareId)
      break
    case 'copyLink':
      copyShareLink(shareId)
      break
    case 'open':
      openShare(shareId)
      break
    case 'delete':
      deleteShare(shareId)
      break
  }
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
            @click="openDetail(share)"
            @touchstart="handleTouchStart($event, share)"
            @touchmove="handleTouchMove"
            @touchend="handleTouchEnd"
            @contextmenu.prevent="handleLongPress($event, share)"
          >
            <div class="share-content">
              <!-- 分享码 -->
              <div class="share-code-row">
                <mdui-chip icon="tag" variant="outlined" class="share-code-chip">
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
          </div>
        </mdui-list>
      </mdui-card>
    </main>

    <!-- 长按菜单遮罩层 -->
    <div v-if="showContextMenu" class="menu-overlay" @click="closeContextMenu"></div>

    <!-- 长按菜单 -->
    <mdui-menu
      v-if="showContextMenu"
      open
      @close="closeContextMenu"
      :style="{
        position: 'fixed',
        left: contextMenuPosition.x + 'px',
        top: contextMenuPosition.y + 'px',
        zIndex: 10001
      }"
    >
      <mdui-menu-item @click="menuAction('copyCode')">
        <mdui-icon slot="icon" name="content_copy"></mdui-icon>
        复制分享码
      </mdui-menu-item>
      <mdui-menu-item @click="menuAction('copyLink')">
        <mdui-icon slot="icon" name="link"></mdui-icon>
        复制链接
      </mdui-menu-item>
      <mdui-menu-item @click="menuAction('open')">
        <mdui-icon slot="icon" name="open_in_new"></mdui-icon>
        打开分享
      </mdui-menu-item>
      <mdui-divider></mdui-divider>
      <mdui-menu-item @click="menuAction('delete')" style="color: var(--mdui-color-error);">
        <mdui-icon slot="icon" name="delete"></mdui-icon>
        删除
      </mdui-menu-item>
    </mdui-menu>

    <!-- 详情全屏页面 -->
    <div v-if="showDetailDialog" class="detail-page">
      <!-- 页面头部 -->
      <div class="detail-page-header">
        <mdui-button-icon icon="arrow_back" @click="closeDetail"></mdui-button-icon>
        <span class="detail-page-title">分享详情</span>
        <div style="width: 40px;"></div>
      </div>

      <!-- 页面内容 -->
      <div v-if="selectedShare" class="detail-page-content">
        <mdui-card class="detail-card">
          <!-- 分享码 -->
          <div class="detail-section">
            <div class="detail-label">分享码</div>
            <div class="detail-value-row">
              <mdui-chip icon="tag" variant="outlined" class="share-code-chip">
                #{{ selectedShare.id }}
              </mdui-chip>
              <mdui-button-icon icon="content_copy" @click="copyShareCode(selectedShare.id)" title="复制分享码">
              </mdui-button-icon>
            </div>
          </div>

          <!-- 内容 -->
          <div class="detail-section">
            <div class="detail-label">分享内容</div>
            <!-- 使用 items 数组显示 -->
            <div v-if="selectedShare.items && selectedShare.items.length > 0" class="detail-content-box">
              <template v-for="(item, index) in selectedShare.items" :key="index">
                <span v-if="item.type === 'text'" class="text-content">
                  {{ getTextPreview(item.content, 50) }}
                </span>
                <mdui-chip v-else-if="item.type === 'image'" size="small" variant="outlined" class="image-chip">
                  <mdui-icon slot="icon" name="image"></mdui-icon>
                  图片
                </mdui-chip>
                <mdui-chip v-else-if="item.type === 'file'" size="small" variant="outlined" class="file-chip">
                  <mdui-icon slot="icon" name="insert_drive_file"></mdui-icon>
                  {{ getTextPreview(item.content, 15) }}
                </mdui-chip>
              </template>
            </div>
            <!-- 旧格式 -->
            <div v-else class="detail-content-box">
              {{ selectedShare.content }}
            </div>
          </div>

          <!-- 信息 -->
          <div class="detail-section">
            <div class="detail-label">分享信息</div>
            <div class="detail-info-row">
              <span class="detail-info-label">权限</span>
              <mdui-chip size="small" variant="outlined">{{ getVisibilityText(selectedShare.visibility) }}</mdui-chip>
            </div>
            <div class="detail-info-row">
              <span class="detail-info-label">创建时间</span>
              <span>{{ formatDate(selectedShare.createdAt) }}</span>
            </div>
            <div class="detail-info-row">
              <span class="detail-info-label">过期时间</span>
              <span>{{ formatDate(selectedShare.expiresAt) }}</span>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="detail-actions">
            <mdui-button variant="filled" @click="copyShareLink(selectedShare.id)" style="flex: 1;">
              <mdui-icon slot="icon" name="link"></mdui-icon>
              复制链接
            </mdui-button>
            <mdui-button variant="outlined" @click="openShare(selectedShare.id)" style="flex: 1;">
              <mdui-icon slot="icon" name="open_in_new"></mdui-icon>
              打开分享
            </mdui-button>
          </div>

          <mdui-button variant="text" @click="deleteShare(selectedShare.id)" style="color: var(--mdui-color-error); margin-top: 8px;">
            <mdui-icon slot="icon" name="delete"></mdui-icon>
            删除分享
          </mdui-button>
        </mdui-card>
      </div>
    </div>
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

/* 长按菜单样式 */
/* 长按菜单遮罩层 */
.menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10000;
  background: transparent;
}

mdui-menu {
  min-width: 180px;
}

/* 详情全屏页面 */
.detail-page {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(245, 245, 250, 0.98);
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.detail-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid var(--mdui-color-outline-variant);
}

.detail-page-title {
  font-size: 18px;
  font-weight: 600;
}

.detail-page-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.detail-card {
  padding: 16px;
}

.detail-section {
  margin-bottom: 24px;
}

.detail-label {
  font-size: 12px;
  color: var(--mdui-color-on-surface-variant);
  margin-bottom: 8px;
}

.detail-value-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-content-box {
  padding: 12px 16px;
  background: var(--mdui-color-surface-container);
  border-radius: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.detail-info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--mdui-color-outline-variant);
}

.detail-info-row:last-child {
  border-bottom: none;
}

.detail-info-label {
  color: var(--mdui-color-on-surface-variant);
  font-size: 14px;
}

.detail-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.image-chip {
  --mdui-chip-outline-color: var(--mdui-color-tertiary-container);
  color: var(--mdui-color-tertiary);
}

.file-chip {
  --mdui-chip-outline-color: var(--mdui-color-secondary-container);
  color: var(--mdui-color-secondary);
}
</style>
