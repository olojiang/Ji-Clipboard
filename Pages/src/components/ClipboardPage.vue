<script setup lang="ts">
import { ref, watch } from 'vue'
import ShareDialog from './ShareDialog.vue'
import AddClipboardDialog from './AddClipboardDialog.vue'

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
  type?: string
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

// 批量分享弹窗状态
const showBatchShareDialog = ref(false)
const batchShareContent = ref('')
const batchShareType = ref('text')

// 删除恢复状态
const lastDeletedItem = ref<{ content: string; createdAt: number; index: number } | null>(null)

// 长按和滑动状态
// 长按菜单状态
const showContextMenu = ref(false)
const contextMenuItem = ref<any>(null)
const contextMenuPosition = ref({ x: 0, y: 0 })
const longPressTimer = ref<number | null>(null)
const bodyLongPressTimer = ref<number | null>(null) // 独立的长按定时器，用于内容区域
const LONG_PRESS_DURATION = 800
const swipeStartX = ref(0)
const swipeStartY = ref(0)
const SWIPE_THRESHOLD = 80
const TAP_THRESHOLD = 10
let hasVibrated = false
let isScrolling = false // 是否正在垂直滚动

// 分享弹窗状态
const showShareDialog = ref(false)
const shareContent = ref('')
const shareType = ref('text')
const shareFileInfo = ref<any>(null)

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

// 调试：监听剪贴板列表变化
watch(() => myClipboards.value, (newVal) => {
  console.log('[watch myClipboards] 列表变化:', newVal)
  newVal.forEach((item, index) => {
    console.log(`[watch myClipboards] 项目 ${index}:`, {
      type: item.type,
      content: item.content?.substring(0, 50),
      createdAt: item.createdAt
    })
  })
}, { deep: true })

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

// 添加文本剪贴板
async function handleAddTextClipboard(content: string) {
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
        content: content,
        type: 'text'
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }

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

// 添加图片剪贴板
async function handleAddImageClipboard(imageUrls: string[]) {
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
        content: JSON.stringify(imageUrls),
        type: 'image'
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }

    showAddClipboardDialog.value = false
    await fetchMyClipboards()
    emit('showToast', '图片添加成功')
  } catch (error) {
    console.error('添加图片剪贴板失败:', error)
    clipboardError.value = (error as Error).message || '添加失败，请重试'
  } finally {
    isAddingClipboard.value = false
  }
}

// 添加文件剪贴板
async function handleAddFileClipboard(fileInfo: { id: string; url: string; originalName: string; size: number; type: string; createdAt: number }) {
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
        content: JSON.stringify(fileInfo),
        type: 'file'
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }

    showAddClipboardDialog.value = false
    await fetchMyClipboards()
    emit('showToast', '文件添加成功')
  } catch (error) {
    console.error('添加文件剪贴板失败:', error)
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
    console.log('[fetchMyClipboards] 获取到的数据:', data)
    myClipboards.value = data.items || []
    console.log('[fetchMyClipboards] 剪贴板列表:', myClipboards.value)
  } catch (error) {
    console.error('获取剪贴板列表失败:', error)
    clipboardsError.value = '获取剪贴板列表失败，请稍后重试'
  } finally {
    clipboardsLoading.value = false
  }
}

// 解析图片内容
function parseImageContent(content: string): string[] {
  console.log('[parseImageContent] 解析内容:', content)
  try {
    const parsed = JSON.parse(content)
    console.log('[parseImageContent] 解析结果:', parsed)
    if (Array.isArray(parsed)) {
      return parsed
    }
  } catch (e) {
    console.log('[parseImageContent] 解析失败:', e)
  }
  return []
}

// 解析文件内容
function parseFileContent(content: string): { id: string; url: string; originalName: string; size: number; type: string; createdAt: number } | null {
  console.log('[parseFileContent] 解析内容:', content)
  try {
    const parsed = JSON.parse(content)
    console.log('[parseFileContent] 解析结果:', parsed)
    if (parsed && typeof parsed === 'object' && parsed.id) {
      return parsed
    }
  } catch (e) {
    console.log('[parseFileContent] 解析失败:', e)
  }
  return null
}

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 下载文件
function downloadFile(url: string, filename: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
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
    // 使用 PUT 请求恢复到原来的位置
    let url = `${API_BASE}/api/clipboard-items/${lastDeletedItem.value.index}`
    if (sessionId) {
      url += `?session=${sessionId}`
    }

    const response = await fetch(url, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        content: lastDeletedItem.value.content,
        createdAt: lastDeletedItem.value.createdAt
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

// 检测内容是否为 HTTP/HTTPS 链接
function isHttpLink(content: string): boolean {
  return /^https?:\/\/.+/i.test(content.trim())
}

// 长按处理
function handleLongPress(event: TouchEvent | MouseEvent, item: any, index: number) {
  // 阻止默认的上下文菜单（特别是在移动端）
  event.preventDefault()
  
  console.log('[LongPress] 显示菜单', item)
  contextMenuItem.value = { ...item, index }
  
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
  contextMenuItem.value = null
}

// 打开分享弹窗
function openShareDialog(item: any) {
  closeContextMenu()
  shareContent.value = item.content
  shareType.value = item.type || 'text'
  // 如果是文件类型，解析文件信息
  if (item.type === 'file') {
    try {
      shareFileInfo.value = JSON.parse(item.content)
    } catch (e) {
      shareFileInfo.value = null
    }
  } else {
    shareFileInfo.value = null
  }
  showShareDialog.value = true
}

// 处理 body 区域的长按
let touchStartTime = 0
let touchStartX = 0
let touchStartY = 0
const TOUCH_MOVE_THRESHOLD = 10 // 移动超过10px取消长按

function handleBodyTouchStart(event: TouchEvent, item: any, index: number) {
  if (isMultiSelectMode.value) return
  
  const touch = event.touches[0]
  touchStartTime = Date.now()
  touchStartX = touch.clientX
  touchStartY = touch.clientY
  
  // 使用独立的定时器，避免与滑动层的定时器冲突
  bodyLongPressTimer.value = window.setTimeout(() => {
    handleLongPress(event, item, index)
    bodyLongPressTimer.value = null
  }, LONG_PRESS_DURATION)
}

function handleBodyTouchMove(event: TouchEvent) {
  if (!bodyLongPressTimer.value) return
  
  const touch = event.touches[0]
  const deltaX = Math.abs(touch.clientX - touchStartX)
  const deltaY = Math.abs(touch.clientY - touchStartY)
  
  // 如果移动超过阈值，取消长按
  if (deltaX > TOUCH_MOVE_THRESHOLD || deltaY > TOUCH_MOVE_THRESHOLD) {
    clearTimeout(bodyLongPressTimer.value)
    bodyLongPressTimer.value = null
    console.log('[TouchMove] 移动超过阈值，取消长按')
  }
}

function handleBodyTouchEnd(event: TouchEvent, item: any, index: number) {
  const touchDuration = Date.now() - touchStartTime
  
  if (bodyLongPressTimer.value) {
    clearTimeout(bodyLongPressTimer.value)
    bodyLongPressTimer.value = null
  }
  
  // 如果触摸时间小于长按阈值，且不是多选模式，不执行任何操作（不弹出菜单）
  if (touchDuration < LONG_PRESS_DURATION && !isMultiSelectMode.value) {
    // 短按不执行任何操作
    console.log('[TouchEnd] 短按，不弹出菜单')
  }
}

// 处理图标点击
function handleIconClick(item: any, index: number) {
  // 如果在多选模式，切换选择状态
  if (isMultiSelectMode.value) {
    toggleSelection(index)
    return
  }
  
  if (isHttpLink(item.content)) {
    // 如果是链接，在新标签页打开
    window.open(item.content.trim(), '_blank')
  } else {
    // 如果不是链接，复制内容
    copyClipboard(item.content)
  }
}
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

// 批量分享选中的项目
function shareSelected() {
  const indices = Array.from(selectedItems.value).sort((a, b) => a - b)
  const selectedContents: string[] = []
  let hasImage = false
  let hasFile = false
  let hasText = false
  
  for (const index of indices) {
    const item = myClipboards.value[index]
    if (item) {
      if (item.type === 'image') {
        hasImage = true
        // 使用完整图片内容，不要截断
        selectedContents.push(`[图片] ${item.content}`)
      } else if (item.type === 'file') {
        hasFile = true
        try {
          const fileInfo = JSON.parse(item.content)
          selectedContents.push(`[文件] ${fileInfo.originalName || '未知文件'}`)
        } catch {
          selectedContents.push('[文件]')
        }
      } else {
        hasText = true
        selectedContents.push(item.content)
      }
    }
  }
  
  // 组合分享内容
  batchShareContent.value = selectedContents.join('\n---\n')
  
  // 确定分享类型
  if (hasImage && !hasFile && !hasText) {
    batchShareType.value = 'image'
  } else if (hasFile && !hasImage && !hasText) {
    batchShareType.value = 'file'
  } else {
    batchShareType.value = 'text'
  }
  
  showBatchShareDialog.value = true
}

// 关闭批量分享弹窗
function closeBatchShareDialog() {
  showBatchShareDialog.value = false
  batchShareContent.value = ''
}

// 批量分享创建成功
function onBatchShareCreated() {
  selectedItems.value.clear()
  isMultiSelectMode.value = false
  emit('showToast', '批量分享创建成功')
}

// 触摸开始 - 仅处理滑动，不处理长按（长按由 handleBodyTouchStart 处理）
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
  
  // 注意：长按功能已移至 handleBodyTouchStart，这里只处理滑动
  // 避免在滑动层设置定时器，防止与内容层的长按菜单冲突
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
    // 取消滑动层的长按定时器（如果存在）
    if (longPressTimer.value) {
      clearTimeout(longPressTimer.value)
      longPressTimer.value = null
    }
    // 同时取消内容层的长按定时器，防止滑动时弹出菜单
    if (bodyLongPressTimer.value) {
      clearTimeout(bodyLongPressTimer.value)
      bodyLongPressTimer.value = null
    }
    isScrolling = true
    return
  }
  
  // 一旦开始水平移动，取消长按定时器
  if (totalDeltaX > TAP_THRESHOLD) {
    if (longPressTimer.value) {
      clearTimeout(longPressTimer.value)
      longPressTimer.value = null
    }
    // 同时取消内容层的长按定时器
    if (bodyLongPressTimer.value) {
      clearTimeout(bodyLongPressTimer.value)
      bodyLongPressTimer.value = null
    }
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

  // 清理滑动层的长按定时器
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }
  
  // 清理内容层的长按定时器（触摸结束时如果还没触发长按，就取消它）
  if (bodyLongPressTimer.value) {
    clearTimeout(bodyLongPressTimer.value)
    bodyLongPressTimer.value = null
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
          <mdui-button variant="outlined" @click="shareSelected" :disabled="selectedItems.size === 0">
            <mdui-icon slot="icon" name="share"></mdui-icon>
            分享
          </mdui-button>
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
          >
            <!-- 左滑背景（删除）-->
            <div v-if="!isMultiSelectMode && item.swipeLeft" class="swipe-bg swipe-bg-left">
              <mdui-icon name="delete" style="font-size: 24px; color: white;"></mdui-icon>
              <span>删除</span>
            </div>
            
            <!-- 右滑背景（多选）-->
            <div v-if="!isMultiSelectMode && item.swipeRight" class="swipe-bg swipe-bg-right">
              <mdui-icon name="check_box" style="font-size: 24px; color: white;"></mdui-icon>
              <span>多选</span>
            </div>
            
            <!-- 内容层 -->
            <div class="swipe-content" :style="{ transform: `translateX(${item.swipeX || 0}px)` }" mdui-ripple
              @touchstart="handleTouchStart($event, item, index)"
              @touchmove="handleTouchMove($event, item)"
              @touchend="handleTouchEnd($event, item, index)"
              @click="isMultiSelectMode && toggleSelection(index)"
            >
              <div class="clipboard-item-row" :class="{ 'is-multi-select': isMultiSelectMode }"
                @contextmenu.prevent="handleLongPress($event, item, index)"
              >
                <mdui-button-icon
                  class="clipboard-icon-btn"
                  :icon="selectedItems.has(index) ? 'check_circle' : (isMultiSelectMode ? 'radio_button_unchecked' : (item.type === 'image' ? 'image' : (item.type === 'file' ? 'insert_drive_file' : (isHttpLink(item.content) ? 'link' : 'content_paste'))))"
                  @click.stop="handleIconClick(item, index)"
                ></mdui-button-icon>
                <div class="clipboard-body"
                  @touchstart="handleBodyTouchStart($event, item, index)"
                  @touchmove="handleBodyTouchMove($event)"
                  @touchend="handleBodyTouchEnd($event, item, index)"
                >
                  <!-- 图片类型 -->
                  <div v-if="item.type === 'image'" class="clipboard-images">
                    <div class="image-grid">
                      <img 
                        v-for="(url, imgIndex) in parseImageContent(item.content)" 
                        :key="imgIndex"
                        :src="url" 
                        class="clipboard-image"
                        @click.stop="openImagePreview(url)"
                      >
                    </div>
                  </div>
                  <!-- 文件类型 -->
                  <div v-else-if="item.type === 'file'" class="clipboard-file">
                    <div class="file-item" v-if="parseFileContent(item.content)">
                      <mdui-icon name="insert_drive_file" style="font-size: 40px; color: var(--mdui-color-primary);"></mdui-icon>
                      <div class="file-details">
                        <span class="file-name">{{ parseFileContent(item.content)?.originalName }}</span>
                        <span class="file-size">{{ formatFileSize(parseFileContent(item.content)?.size || 0) }}</span>
                      </div>
                      <mdui-button-icon
                        icon="download"
                        title="下载文件"
                        @click.stop="downloadFile(parseFileContent(item.content)!.url, parseFileContent(item.content)!.originalName)"
                      ></mdui-button-icon>
                    </div>
                  </div>
                  <!-- 文本类型 -->
                  <div v-else class="clipboard-text">{{ item.content }}</div>
                  <div class="clipboard-date">{{ formatDate(item.createdAt) }}</div>
                </div>
              </div>
            </div>
          </div>
        </mdui-list>
      </mdui-card>

      <!-- 悬浮添加按钮 -->
      <mdui-fab v-if="!isMultiSelectMode" class="fab-add" icon="add" @click="showAddClipboardDialog = true"></mdui-fab>

      <!-- 长按菜单遮罩层 -->
      <div v-if="showContextMenu" class="menu-overlay" @click="closeContextMenu"></div>
      
      <!-- 长按菜单 - 使用 MDUI Menu -->
      <mdui-menu
        v-if="showContextMenu"
        :open="true"
        @close="closeContextMenu"
        :style="{ position: 'fixed', left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px', 'z-index': '10001' }"
      >
        <!-- 复制选项 -->
        <mdui-menu-item @click="copyClipboard(contextMenuItem?.content); closeContextMenu()">
          <mdui-icon slot="icon" name="content_copy"></mdui-icon>
          复制
        </mdui-menu-item>
        <!-- 分享选项 -->
        <mdui-menu-item @click="openShareDialog(contextMenuItem)">
          <mdui-icon slot="icon" name="share"></mdui-icon>
          分享
        </mdui-menu-item>
        <!-- 如果是链接，显示在新标签页打开选项 -->
        <mdui-menu-item v-if="contextMenuItem && isHttpLink(contextMenuItem.content)" @click="window.open(contextMenuItem.content.trim(), '_blank'); closeContextMenu()">
          <mdui-icon slot="icon" name="open_in_new"></mdui-icon>
          在新标签页打开
        </mdui-menu-item>
        <mdui-menu-item @click="deleteClipboard(contextMenuItem?.index, true); closeContextMenu()">
          <mdui-icon slot="icon" name="delete" style="color: var(--mdui-color-error)"></mdui-icon>
          <span style="color: var(--mdui-color-error)">删除</span>
        </mdui-menu-item>
      </mdui-menu>

      <!-- 分享弹窗 -->
      <ShareDialog
        :open="showShareDialog"
        :content="shareContent"
        :type="shareType"
        :file-info="shareFileInfo"
        @close="showShareDialog = false"
        @share-created="emit('showToast', '分享创建成功')"
        @show-toast="emit('showToast', $event)"
      />

      <!-- 批量分享弹窗 -->
      <ShareDialog
        :open="showBatchShareDialog"
        :content="batchShareContent"
        :type="batchShareType"
        @close="closeBatchShareDialog"
        @share-created="onBatchShareCreated"
        @show-toast="emit('showToast', $event)"
      />

      <!-- 添加剪贴板弹窗 -->
      <AddClipboardDialog
        :open="showAddClipboardDialog"
        @close="closeAddClipboardDialog"
        @add-text="handleAddTextClipboard"
        @add-images="handleAddImageClipboard"
        @add-file="handleAddFileClipboard"
      />
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
  justify-content: flex-start;
  padding-left: 24px;
}

.swipe-bg-right {
  right: 0;
  background: #4CAF50;
  color: white;
  justify-content: flex-end;
  padding-right: 24px;
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

.clipboard-item-row {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 12px 16px;
  background: white;
  min-height: 48px;
}

.clipboard-item-row.is-multi-select {
  background: var(--mdui-color-primary-container);
}

.clipboard-icon-btn {
  align-self: center;
  flex-shrink: 0;
}

.clipboard-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  user-select: none;
  -webkit-user-select: none;
  padding: 8px;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.clipboard-body:active {
  background: var(--mdui-color-surface-container-highest);
}

.clipboard-images {
  width: 100%;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 8px;
}

.clipboard-image {
  width: 100%;
  height: 80px;
  object-fit: cover;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.2s;
}

.clipboard-image:hover {
  transform: scale(1.05);
}

.clipboard-text {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
  color: var(--mdui-color-on-surface);
  font-size: 16px;
}

.clipboard-file {
  width: 100%;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--mdui-color-surface-container);
  border-radius: 8px;
}

.file-details {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-details .file-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--mdui-color-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-details .file-size {
  font-size: 12px;
  color: var(--mdui-color-on-surface-variant);
}

.clipboard-date {
  font-size: 14px;
  color: var(--mdui-color-on-surface-variant);
}

.menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10000;
  background: transparent;
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