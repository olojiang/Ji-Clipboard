<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  user: { loggedIn: boolean }
  authLoading: boolean
}>()

const emit = defineEmits(['showToast'])

// API 基础地址
const API_BASE = import.meta.env.VITE_API_URL || 'https://ji-clipboard-worker.olojiang.workers.dev'

// 剪贴板状态
const clipboardInput = ref('')
const isAddingClipboard = ref(false)
const clipboardError = ref('')
const showAddClipboardDialog = ref(false)
const myClipboards = ref<Array<{
  content: string
  createdAt: number
  swipeX?: number
  swipeLeft?: boolean
  swipeRight?: boolean
}>>([])
const clipboardsLoading = ref(false)
const clipboardsError = ref('')

// 多选模式状态
const isMultiSelectMode = ref(false)
const selectedItems = ref<Set<number>>(new Set())

// 删除恢复状态
const lastDeletedItem = ref<{ content: string; createdAt: number; index: number } | null>(null)

// 长按和滑动状态
const longPressTimer = ref<number | null>(null)
const LONG_PRESS_DURATION = 800
const swipeStartX = ref(0)
const swipeStartY = ref(0)
const SWIPE_THRESHOLD = 80
const TAP_THRESHOLD = 10
let hasVibrated = false
let isScrolling = false // 是否正在垂直滚动

// 惯性滑动状态
const velocity = ref(0)
const lastX = ref(0)
const lastY = ref(0)
const lastTime = ref(0)
let animationFrame: number | null = null

// 监听登录状态，自动加载数据
watch(() => props.user.loggedIn, (loggedIn) => {
  if (loggedIn) {
    fetchMyClipboards()
  }
}, { immediate: true })

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

// 关闭添加弹窗
function closeAddClipboardDialog() {
  showAddClipboardDialog.value = false
  clipboardInput.value = ''
  clipboardError.value = ''
}

// 添加剪贴板
async function handleAddClipboard() {
  if (!clipboardInput.value || !clipboardInput.value.trim()) {
    clipboardError.value = '请输入剪贴板内容'
    return
  }

  clipboardError.value = ''
  isAddingClipboard.value = true

  try {
    const sessionId = localStorage.getItem('session_id')
    let url = `${API_BASE}/api/clipboard-items`
    if (sessionId) {
      url += `?session=${sessionId}`
    }

    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        content: clipboardInput.value.trim()
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }

    clipboardInput.value = ''
    showAddClipboardDialog.value = false
    await fetchMyClipboards()
    emit('showToast', '添加成功')
  } catch (error) {
    console.error('添加剪贴板失败:', error)
    clipboardError.value = (error as Error).message || '添加失败，请重试'
  } finally {
    isAddingClipboard.value = false
  }
}

// 获取剪贴板列表
async function fetchMyClipboards() {
  if (!props.user.loggedIn) return
  
  clipboardsLoading.value = true
  clipboardsError.value = ''

  try {
    const sessionId = localStorage.getItem('session_id')
    let url = `${API_BASE}/api/clipboard-items`
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
    myClipboards.value = data.items || []
  } catch (error) {
    console.error('获取剪贴板列表失败:', error)
    clipboardsError.value = '获取剪贴板列表失败，请稍后重试'
  } finally {
    clipboardsLoading.value = false
  }
}

// 复制剪贴板内容
function copyClipboard(content: string) {
  navigator.clipboard.writeText(content).then(() => {
    emit('showToast', '已复制到剪贴板')
  }).catch(() => {
    const input = document.createElement('input')
    input.value = content
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    emit('showToast', '已复制到剪贴板')
  })
}

// 删除剪贴板
async function deleteClipboard(index: number, showUndoToast: boolean = true) {
  const item = myClipboards.value[index]
  if (!item) return

  // 保存被删除的数据用于恢复
  lastDeletedItem.value = {
    content: item.content,
    createdAt: item.createdAt,
    index: index
  }

  try {
    const sessionId = localStorage.getItem('session_id')
    let url = `${API_BASE}/api/clipboard-items/${index}`
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

    await fetchMyClipboards()
    
    // 显示带撤回按钮的提示
    if (showUndoToast) {
      emit('showToast', '已删除', true)
    } else {
      emit('showToast', '已删除')
    }
  } catch (error) {
    console.error('删除剪贴板失败:', error)
    emit('showToast', '删除失败')
    lastDeletedItem.value = null
  }
}

// 恢复删除的剪贴板
async function undoDelete() {
  if (!lastDeletedItem.value) return

  try {
    const sessionId = localStorage.getItem('session_id')
    let url = `${API_BASE}/api/clipboard-items`
    if (sessionId) {
      url += `?session=${sessionId}`
    }

    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        content: lastDeletedItem.value.content
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    lastDeletedItem.value = null
    await fetchMyClipboards()
    emit('showToast', '已撤回')
  } catch (error) {
    console.error('恢复剪贴板失败:', error)
    emit('showToast', '撤回失败')
  }
}

// 暴露方法给父组件
defineExpose({
  undoDelete
})

// 切换选择状态
function toggleSelection(index: number) {
  if (selectedItems.value.has(index)) {
    selectedItems.value.delete(index)
  } else {
    selectedItems.value.add(index)
  }
}

// 退出多选模式
function exitMultiSelectMode() {
  isMultiSelectMode.value = false
  selectedItems.value.clear()
}

// 删除选中的项目
async function deleteSelected() {
  const indices = Array.from(selectedItems.value).sort((a, b) => b - a)
  
  for (const index of indices) {
    try {
      const sessionId = localStorage.getItem('session_id')
      let url = `${API_BASE}/api/clipboard-items/${index}`
      if (sessionId) {
        url += `?session=${sessionId}`
      }

      await fetch(url, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      })
    } catch (error) {
      console.error('删除失败:', error)
    }
  }
  
  selectedItems.value.clear()
  isMultiSelectMode.value = false
  await fetchMyClipboards()
  emit('showToast', `已删除 ${indices.length} 项`)
}

// 触摸开始
function handleTouchStart(event: TouchEvent, item: any, index: number) {
  console.log('[TouchStart] index:', index, 'isMultiSelectMode:', isMultiSelectMode.value)
  
  // 如果已经在多选模式，直接返回
  if (isMultiSelectMode.value) {
    console.log('[TouchStart] 多选模式，跳过')
    return
  }
  
  // 停止之前的动画
  if (animationFrame) {
    cancelAnimationFrame(animationFrame)
    animationFrame = null
  }
  
  const touch = event.touches[0]
  swipeStartX.value = touch.clientX
  swipeStartY.value = touch.clientY
  lastX.value = touch.clientX
  lastY.value = touch.clientY
  lastTime.value = Date.now()
  velocity.value = 0
  hasVibrated = false
  isScrolling = false
  
  console.log('[TouchStart] startX:', swipeStartX.value, 'startY:', swipeStartY.value)
  
  myClipboards.value.forEach(i => {
    i.swipeX = 0
    i.swipeLeft = false
    i.swipeRight = false
  })
  
  longPressTimer.value = window.setTimeout(() => {
    console.log('[TouchStart] 长按触发复制')
    if (navigator.vibrate) navigator.vibrate(50)
    copyClipboard(item.content)
    longPressTimer.value = null
    isScrolling = true // 长按后不处理滑动
  }, LONG_PRESS_DURATION)
}

// 触摸移动
function handleTouchMove(event: TouchEvent, item: any) {
  // 如果已经在多选模式，不处理滑动
  if (isMultiSelectMode.value) return
  
  // 如果正在垂直滚动，不处理滑动
  if (isScrolling) return
  
  const touch = event.touches[0]
  const currentX = touch.clientX
  const currentY = touch.clientY
  
  // 计算移动距离
  const totalDeltaX = Math.abs(currentX - swipeStartX.value)
  const totalDeltaY = Math.abs(currentY - swipeStartY.value)
  
  // 如果垂直移动明显大于水平移动（2倍以上），认为是滚动
  if (totalDeltaY > totalDeltaX * 2 && totalDeltaY > TAP_THRESHOLD) {
    console.log('[TouchMove] 垂直滚动，取消长按')
    if (longPressTimer.value) {
      clearTimeout(longPressTimer.value)
      longPressTimer.value = null
    }
    isScrolling = true
    return
  }
  
  // 一旦开始水平移动，取消长按
  if (longPressTimer.value && totalDeltaX > TAP_THRESHOLD) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }
  
  const currentTime = Date.now()
  const moveDeltaX = currentX - lastX.value
  const deltaTime = currentTime - lastTime.value
  if (deltaTime > 0) {
    velocity.value = moveDeltaX / deltaTime * 16
  }
  
  lastX.value = currentX
  lastY.value = currentY
  lastTime.value = currentTime
  
  const diffX = currentX - swipeStartX.value
  
  // 使用更柔和的阻力效果
  const maxSwipe = 120
  let swipeX = diffX
  
  // 超出范围时添加阻力
  if (swipeX > maxSwipe) {
    swipeX = maxSwipe + (swipeX - maxSwipe) * 0.3
  } else if (swipeX < -maxSwipe) {
    swipeX = -maxSwipe + (swipeX + maxSwipe) * 0.3
  }
  
  item.swipeX = swipeX
  
  // 实时更新滑动方向指示
  if (diffX < -SWIPE_THRESHOLD) {
    if (!item.swipeLeft) {
      item.swipeLeft = true
      item.swipeRight = false
      if (!hasVibrated) {
        hasVibrated = true
        if (navigator.vibrate) navigator.vibrate(20)
      }
    }
  } else if (diffX > SWIPE_THRESHOLD) {
    if (!item.swipeRight) {
      item.swipeRight = true
      item.swipeLeft = false
      if (!hasVibrated) {
        hasVibrated = true
        if (navigator.vibrate) navigator.vibrate(20)
      }
    }
  } else {
    item.swipeLeft = false
    item.swipeRight = false
    hasVibrated = false
  }
}

// 触摸结束 - 添加惯性回弹
function handleTouchEnd(event: TouchEvent, item: any, index: number) {
  console.log('[TouchEnd] index:', index, 'swipeRight:', item.swipeRight, 'swipeX:', item.swipeX)

  // 如果已经在多选模式，不处理
  if (isMultiSelectMode.value) {
    console.log('[TouchEnd] 多选模式，跳过')
    return
  }

  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }

  // 如果右滑超过阈值，立即进入多选模式，同时播放回弹动画
  if (item.swipeRight) {
    console.log('[TouchEnd] 右滑超过阈值，立即进入多选模式并播放回弹动画')
    isMultiSelectMode.value = true
    selectedItems.value.clear()
    selectedItems.value.add(index)
  }

  // 如果左滑超过阈值，执行删除操作，同时播放回弹动画
  if (item.swipeLeft) {
    console.log('[TouchEnd] 左滑超过阈值，执行删除并播放回弹动画')
    deleteClipboard(index, true)
  }

  // 惯性滑动
  const inertia = () => {
    if (Math.abs(velocity.value) < 0.5) {
      springBack()
      return
    }

    item.swipeX = (item.swipeX || 0) + velocity.value

    const maxSwipe = 150
    if (item.swipeX > maxSwipe) {
      item.swipeX = maxSwipe
      velocity.value = 0
    }
    if (item.swipeX < -maxSwipe) {
      item.swipeX = -maxSwipe
      velocity.value = 0
    }

    velocity.value *= 0.95
    animationFrame = requestAnimationFrame(inertia)
  }

  // 回弹动画
  const springBack = () => {
    const targetX = 0
    const currentX = item.swipeX || 0
    const diff = targetX - currentX

    if (Math.abs(diff) < 0.5) {
      item.swipeX = 0
      item.swipeLeft = false
      item.swipeRight = false
      hasVibrated = false
      return
    }

    item.swipeX = currentX + diff * 0.15
    animationFrame = requestAnimationFrame(springBack)
  }

  animationFrame = requestAnimationFrame(inertia)
}
</script>

<template>
  <div class="section">
    <!-- 加载中状态 -->
    <mdui-card v-if="authLoading" class="clipboard-card">
      <div class="loading-state">
        <div class="spinner"></div>
        <p>正在检查登录状态...</p>
      </div>
    </mdui-card>

    <!-- 未登录状态 -->
    <mdui-card v-else-if="!user.loggedIn" class="clipboard-card">
      <div class="login-required-state">
        <mdui-icon name="lock" style="font-size: 64px; color: var(--mdui-color-on-surface-variant);"></mdui-icon>
        <h3 class="login-required-title">需要登录</h3>
        <p class="login-required-subtitle">请先使用 GitHub 登录后再使用剪贴板</p>
      </div>
    </mdui-card>

    <!-- 已登录状态 -->
    <template v-else>
      <!-- 多选模式工具栏 -->
      <div v-if="isMultiSelectMode" class="multi-select-toolbar">
        <span>已选择 {{ selectedItems.size }} 项</span>
        <div class="toolbar-actions">
          <mdui-button variant="text" @click="exitMultiSelectMode">取消</mdui-button>
          <mdui-button variant="filled" @click="deleteSelected" :disabled="selectedItems.size === 0">删除</mdui-button>
        </div>
      </div>

      <!-- 我的剪贴板列表 -->
      <mdui-card class="clipboard-list-card">
        <div class="clipboard-list-header">
          <span class="clipboard-list-title">我的剪贴板</span>
          <mdui-button v-if="!isMultiSelectMode" variant="text" @click="fetchMyClipboards" :loading="clipboardsLoading">
            <mdui-icon slot="icon" name="refresh"></mdui-icon>
            刷新
          </mdui-button>
        </div>

        <div v-if="clipboardsLoading" class="loading-state">
          <div class="spinner"></div>
          <p>正在加载...</p>
        </div>

        <div v-else-if="clipboardsError" class="error-state">
          <mdui-icon name="error_outline" style="font-size: 48px; color: var(--mdui-color-error);"></mdui-icon>
          <p>{{ clipboardsError }}</p>
          <mdui-button variant="filled" @click="fetchMyClipboards">重试</mdui-button>
        </div>

        <div v-else-if="myClipboards.length === 0" class="empty-state">
          <mdui-icon name="inbox" style="font-size: 64px; opacity: 0.5;"></mdui-icon>
          <p>暂无剪贴板内容</p>
        </div>

        <mdui-list v-else class="clipboard-list">
          <div
            v-for="(item, index) in myClipboards"
            :key="index"
            class="swipe-item"
            :class="{ 'swiping-left': item.swipeLeft, 'swiping-right': item.swipeRight, 'is-selected': selectedItems.has(index) }"
            @touchstart="handleTouchStart($event, item, index)"
            @touchmove="handleTouchMove($event, item)"
            @touchend="handleTouchEnd($event, item, index)"
            @click="isMultiSelectMode && toggleSelection(index)"
          >
            <!-- 左滑背景（删除）-->
            <div v-if="!isMultiSelectMode" class="swipe-bg swipe-bg-left">
              <mdui-icon name="delete" style="font-size: 24px; color: white;"></mdui-icon>
              <span>删除</span>
            </div>
            
            <!-- 右滑背景（多选）-->
            <div v-if="!isMultiSelectMode" class="swipe-bg swipe-bg-right">
              <mdui-icon name="check_box" style="font-size: 24px; color: white;"></mdui-icon>
              <span>多选</span>
            </div>
            
            <!-- 内容层 -->
            <div class="swipe-content" :style="{ transform: `translateX(${item.swipeX || 0}px)` }">
              <div class="clipboard-item" :class="{ 'is-multi-select': isMultiSelectMode }">
                <mdui-icon 
                  class="clipboard-icon" 
                  :name="selectedItems.has(index) ? 'check_circle' : (isMultiSelectMode ? 'radio_button_unchecked' : 'content_paste')"
                ></mdui-icon>
                <div class="clipboard-body">
                  <div class="clipboard-content">{{ item.content }}</div>
                  <div class="clipboard-date">{{ formatDate(item.createdAt) }}</div>
                </div>
                <div v-if="!isMultiSelectMode" class="clipboard-actions">
                  <mdui-button-icon icon="content_copy" @click.stop="copyClipboard(item.content)" title="复制"></mdui-button-icon>
                  <mdui-button-icon icon="delete" @click.stop="deleteClipboard(index, false)" title="删除"></mdui-button-icon>
                </div>
              </div>
            </div>
          </div>
        </mdui-list>
      </mdui-card>

      <!-- 悬浮添加按钮 -->
      <mdui-fab v-if="!isMultiSelectMode" class="fab-add" icon="add" @click="showAddClipboardDialog = true"></mdui-fab>

      <!-- 添加剪贴板弹窗 -->
      <mdui-dialog
        :open="showAddClipboardDialog"
        @close="closeAddClipboardDialog"
        headline="添加剪贴板"
        style="max-width: 500px; width: 90%;"
      >
        <textarea
          v-model="clipboardInput"
          class="clipboard-dialog-textarea"
          placeholder="在此输入剪贴板内容..."
          rows="3"
        ></textarea>
        <div v-if="clipboardError" class="error-message" style="margin-top: 8px;">
          <mdui-icon name="error" style="font-size: 16px;"></mdui-icon>
          {{ clipboardError }}
        </div>
        <mdui-button slot="action" variant="text" @click="closeAddClipboardDialog">取消</mdui-button>
        <mdui-button slot="action" variant="filled" :loading="isAddingClipboard" @click="handleAddClipboard">添加</mdui-button>
      </mdui-dialog>
    </template>
  </div>
</template>

<style scoped>
.clipboard-card {
  padding: 16px;
  width: 100%;
  box-sizing: border-box;
}

.loading-state, .error-state, .empty-state {
  text-align: center;
  padding: 24px;
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

.login-required-state {
  text-align: center;
  padding: 24px;
}

.login-required-title {
  font-size: 20px;
  font-weight: 600;
  margin: 24px 0 8px 0;
}

.login-required-subtitle {
  font-size: 14px;
  color: var(--mdui-color-on-surface-variant);
  margin: 0 0 24px 0;
}

.multi-select-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--mdui-color-primary-container);
  border-radius: 8px;
  margin-bottom: 16px;
}

.toolbar-actions {
  display: flex;
  gap: 8px;
}

.clipboard-list-card {
  padding: 16px;
  width: 100%;
  box-sizing: border-box;
}

.clipboard-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding: 0 8px;
}

.clipboard-list-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--mdui-color-on-surface-variant);
  letter-spacing: 1px;
}

.clipboard-list {
  padding: 0;
}

.swipe-item {
  position: relative;
  overflow: hidden;
  margin-bottom: 8px;
  border-radius: 8px;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
}

.swipe-item.is-selected .swipe-content {
  background: var(--mdui-color-primary-container);
}

.swipe-item.is-selected .swipe-content mdui-list-item {
  background: var(--mdui-color-primary-container) !important;
  --mdui-color-surface: var(--mdui-color-primary-container);
}

.swipe-bg {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 100%;
  display: flex;
  align-items: center;
  padding: 0 24px;
}

.swipe-bg-left {
  left: 0;
  background: #F44336;
  color: white;
  justify-content: flex-end;
}

.swipe-bg-right {
  right: 0;
  background: #4CAF50;
  color: white;
  justify-content: flex-start;
}

.swipe-bg span {
  margin-left: 8px;
  font-size: 14px;
  font-weight: 500;
}

.swipe-content {
  position: relative;
  background: white;
  will-change: transform;
  z-index: 2;
}

.swipe-content mdui-list-item {
  background: white !important;
  --mdui-color-surface: white;
}

.clipboard-content {
  white-space: pre-wrap;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.5;
  max-height: 4.5em;
  color: var(--mdui-color-on-surface);
  font-size: 16px;
}

.clipboard-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 12px 16px;
  background: white;
  min-height: 48px;
}

.clipboard-item.is-multi-select {
  background: var(--mdui-color-primary-container);
}

.clipboard-icon {
  font-size: 24px;
  color: var(--mdui-color-on-surface-variant);
  flex-shrink: 0;
  margin-top: 4px;
}

.clipboard-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.clipboard-date {
  font-size: 14px;
  color: var(--mdui-color-on-surface-variant);
}

.clipboard-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.fab-add {
  position: fixed;
  right: 16px;
  bottom: 96px;
  z-index: 100;
}

.clipboard-dialog-textarea {
  width: 100%;
  min-height: 80px;
  padding: 12px 16px;
  border: 1px solid var(--mdui-color-outline);
  border-radius: 8px;
  font-family: inherit;
  font-size: 16px;
  line-height: 1.5;
  resize: vertical;
  background: var(--mdui-color-surface);
  color: var(--mdui-color-on-surface);
}

.clipboard-dialog-textarea:focus {
  outline: none;
  border-color: var(--mdui-color-primary);
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--mdui-color-error);
  font-size: 14px;
}
</style>