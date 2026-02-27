<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import MarkdownIt from 'markdown-it'

const emit = defineEmits(['showToast'])

// API 基础地址
const API_BASE = import.meta.env.VITE_API_URL || 'https://ji-clipboard-worker.olojiang.workers.dev'

// 初始化 markdown-it
const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true
})

// 解析批量分享内容（多个剪贴板项用 --- 分隔）
function parseBatchShareContent(content: string): Array<{ type: string; content: string; imageUrls?: string[] }> {
  if (!content) return []

  // 检查是否是批量分享（包含分隔符 ---）
  if (!content.includes('\n---\n')) {
    // 单个分享
    return [{ type: fetchedType.value, content }]
  }

  // 批量分享，按分隔符分割
  const items = content.split('\n---\n')
  return items.map(item => {
    const trimmed = item.trim()
    // 判断类型
    if (trimmed.startsWith('[图片]')) {
      const imageContent = trimmed.substring(4).trim()
      // 尝试解析图片 JSON 数组
      let imageUrls: string[] = []
      try {
        const parsed = JSON.parse(imageContent)
        if (Array.isArray(parsed)) {
          imageUrls = parsed
        }
      } catch (e) {
        // 如果不是 JSON，可能是单个 URL
        if (imageContent.startsWith('http')) {
          imageUrls = [imageContent]
        }
      }
      return { type: 'image', content: imageContent, imageUrls }
    } else if (trimmed.startsWith('[文件]')) {
      return { type: 'file', content: trimmed.substring(4).trim() }
    } else {
      return { type: 'text', content: trimmed }
    }
  })
}

// 获取相关状态
const fetchCode = ref('')
const isFetching = ref(false)
const fetchError = ref('')
const fetchedContent = ref('')
const fetchedType = ref('text') // 分享类型：text, image, file
const fetchedFileInfo = ref<any>(null) // 文件信息
const fetchedCode = ref('')
const isShareContent = ref(false) // 标记是否是分享内容
const shareExpiresAt = ref<number | null>(null) // 分享过期时间

// 权限错误弹窗状态
const showPermissionDialog = ref(false)
const permissionErrorTitle = ref('')
const permissionErrorMessage = ref('')

// 分享不存在弹窗状态
const showNotFoundDialog = ref(false)
const notFoundMessage = ref('')

// 计算属性：渲染获取到的内容
const renderedFetchedContent = computed(() => {
  if (!fetchedContent.value) return ''
  return md.render(fetchedContent.value)
})

// 用于 v-model 的计算属性
const fetchCodeModel = computed({
  get: () => fetchCode.value,
  set: (val: string) => {
    fetchCode.value = val
    console.log('[FetchPage] fetchCode 更新:', val)
  }
})

// 页面加载时检查是否有待处理的分享码
onMounted(() => {
  const pendingShareCode = localStorage.getItem('pending_share_code')
  if (pendingShareCode) {
    console.log('[FetchPage] 检测到待处理的分享码:', pendingShareCode)
    fetchCode.value = pendingShareCode
    localStorage.removeItem('pending_share_code')
    // 自动获取分享内容
    handleFetchShare(pendingShareCode)
  }
})

// 处理获取剪贴板（5位提取码）
async function handleFetch() {
  console.log('[FetchPage] handleFetch 被调用，输入值:', fetchCode.value)

  if (!fetchCode.value || fetchCode.value.length !== 5) {
    console.log('[FetchPage] 输入无效:', fetchCode.value)
    fetchError.value = '请输入5位提取码'
    return
  }

  fetchError.value = ''
  isFetching.value = true
  fetchedContent.value = ''

  try {
    const clipboardUrl = `${API_BASE}/api/clipboard?code=${fetchCode.value}`
    console.log('[FetchPage] 尝试获取剪贴板:', clipboardUrl)

    const response = await fetch(clipboardUrl, {
      headers: {
        'Accept': 'application/json'
      }
    })

    console.log('[FetchPage] 剪贴板响应状态:', response.status)

    if (response.status === 404) {
      // 可能是分享码，尝试获取分享内容
      console.log('[FetchPage] 提取码未找到，尝试作为分享码获取:', fetchCode.value)
      await handleFetchShare(fetchCode.value)
      return
    }

    if (response.status === 410) {
      fetchError.value = '内容已过期'
      isFetching.value = false
      return
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    console.log('[FetchPage] 剪贴板获取成功:', data)
    // 跳转到查看页面
    window.location.href = `./view.html?code=${fetchCode.value}`
  } catch (error) {
    console.error('获取失败:', error)
    fetchError.value = '获取失败，请稍后重试'
  } finally {
    isFetching.value = false
  }
}

// 处理获取分享内容
async function handleFetchShare(shareCode: string) {
  console.log('[FetchPage] handleFetchShare 被调用，分享码:', shareCode)
  fetchError.value = ''
  isFetching.value = true
  fetchedContent.value = ''
  isShareContent.value = true

  try {
    const sessionId = localStorage.getItem('session_id')
    let url = `${API_BASE}/api/shares/${shareCode}`
    if (sessionId) {
      url += `?session=${sessionId}`
    }
    console.log('[FetchPage] 分享API请求URL:', url)

    console.log('[FetchPage] 开始发送请求...')
    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
    })

    console.log('[FetchPage] 分享API响应状态:', response.status)
    console.log('[FetchPage] 分享API响应状态文本:', response.statusText)

    if (response.status === 404) {
      console.log('[FetchPage] 分享不存在 (404)')
      notFoundMessage.value = '该分享不存在或已被删除。'
      showNotFoundDialog.value = true
      isFetching.value = false
      return
    }

    if (response.status === 401) {
      console.log('[FetchPage] 需要登录 (401)')
      permissionErrorTitle.value = '需要登录'
      permissionErrorMessage.value = '此分享需要登录后才能查看，请先登录。'
      showPermissionDialog.value = true
      isFetching.value = false
      return
    }

    if (response.status === 403) {
      console.log('[FetchPage] 无权查看 (403)')
      permissionErrorTitle.value = '无权查看'
      permissionErrorMessage.value = '您没有权限查看此分享内容。'
      showPermissionDialog.value = true
      isFetching.value = false
      return
    }

    if (response.status === 410) {
      console.log('[FetchPage] 分享已过期 (410)')
      notFoundMessage.value = '该分享已过期。'
      showNotFoundDialog.value = true
      isFetching.value = false
      return
    }

    if (!response.ok) {
      console.log('[FetchPage] 请求失败，状态码:', response.status)
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    console.log('[FetchPage] 分享API获取成功，数据:', data)

    if (!data.content) {
      console.log('[FetchPage] 警告: 返回数据中没有 content 字段')
    }

    fetchedContent.value = data.content
    fetchedType.value = data.type || 'text'

    // 处理文件信息：优先使用 fileInfo，如果是文件类型且 fileInfo 为空，尝试从 content 解析
    if (data.type === 'file' && !data.fileInfo) {
      try {
        const parsedContent = JSON.parse(data.content)
        if (parsedContent && parsedContent.id) {
          fetchedFileInfo.value = parsedContent
        } else {
          fetchedFileInfo.value = null
        }
      } catch {
        fetchedFileInfo.value = null
      }
    } else {
      fetchedFileInfo.value = data.fileInfo || null
    }

    fetchedCode.value = shareCode
    shareExpiresAt.value = data.expiresAt || null
    console.log('[FetchPage] 内容已设置，长度:', data.content?.length, '类型:', fetchedType.value, '文件信息:', fetchedFileInfo.value)
    emit('showToast', '分享内容已获取')
  } catch (error) {
    console.error('[FetchPage] 获取分享失败，错误:', error)
    fetchError.value = '获取分享失败，请稍后重试'
  } finally {
    console.log('[FetchPage] handleFetchShare 结束，isFetching:', isFetching.value)
    isFetching.value = false
  }
}

// 清除获取的内容
function clearFetchedContent() {
  fetchedContent.value = ''
  fetchedType.value = 'text'
  fetchedFileInfo.value = null
  fetchedCode.value = ''
  fetchCode.value = ''
  isShareContent.value = false
  shareExpiresAt.value = null
}

// 复制内容
function copyContent() {
  if (!fetchedContent.value) return

  navigator.clipboard.writeText(fetchedContent.value).then(() => {
    emit('showToast', '内容已复制')
  }).catch(() => {
    const input = document.createElement('input')
    input.value = fetchedContent.value
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    emit('showToast', '内容已复制')
  })
}

// 复制分享码
function copyShareCode() {
  if (!fetchedCode.value) return

  navigator.clipboard.writeText(fetchedCode.value).then(() => {
    emit('showToast', '分享码已复制')
  }).catch(() => {
    const input = document.createElement('input')
    input.value = fetchedCode.value
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    emit('showToast', '分享码已复制')
  })
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

// 解析图片内容
function parseImageContent(content: string): string[] {
  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed)) {
      return parsed
    }
  } catch (e) {
    // 如果不是 JSON，返回空数组
  }
  return []
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
function downloadFile() {
  if (fetchedFileInfo.value?.url) {
    window.open(fetchedFileInfo.value.url, '_blank')
  }
}

// 关闭权限错误弹窗
function closePermissionDialog() {
  showPermissionDialog.value = false
  permissionErrorTitle.value = ''
  permissionErrorMessage.value = ''
}

// 关闭不存在弹窗
function closeNotFoundDialog() {
  showNotFoundDialog.value = false
  notFoundMessage.value = ''
}
</script>

<template>
  <div class="section">
    <!-- 显示获取到的内容 - 全屏遮罩样式 -->
    <div v-if="fetchedContent" class="share-overlay">
      <!-- 顶部栏 -->
      <div class="share-overlay-header">
        <div style="display: flex; align-items: center; gap: 12px;">
          <mdui-chip icon="tag" variant="outlined" style="font-family: monospace; font-weight: 600;">
            {{ isShareContent ? '分享码' : '提取码' }}: {{ fetchedCode }}
          </mdui-chip>
          <mdui-button-icon icon="content_copy" @click="copyShareCode" title="复制分享码"></mdui-button-icon>
        </div>
        <mdui-button-icon icon="close" @click="clearFetchedContent" class="close-btn"></mdui-button-icon>
      </div>

      <!-- 内容区域 -->
      <div class="share-overlay-content">
        <!-- 单个分享 -->
        <mdui-card v-if="parseBatchShareContent(fetchedContent).length === 1" class="share-content-card">
          <!-- 文本类型 -->
          <div v-if="fetchedType === 'text'" class="markdown-body" v-html="renderedFetchedContent"></div>

          <!-- 图片类型 -->
          <div v-else-if="fetchedType === 'image'" class="image-share-content">
            <div class="image-grid">
              <img
                v-for="(url, index) in parseImageContent(fetchedContent)"
                :key="index"
                :src="url"
                class="share-image"
                @click="window.open(url, '_blank')"
              >
            </div>
          </div>

          <!-- 文件类型 -->
          <div v-else-if="fetchedType === 'file'" class="file-share-content">
            <div class="file-card">
              <mdui-icon name="insert_drive_file" style="font-size: 64px; color: var(--mdui-color-primary);"></mdui-icon>
              <div class="file-info">
                <span class="file-name">{{ fetchedFileInfo?.originalName || '未知文件' }}</span>
                <span class="file-size">{{ formatFileSize(fetchedFileInfo?.size || 0) }}</span>
              </div>
              <mdui-button variant="filled" @click="downloadFile">
                <mdui-icon slot="icon" name="download"></mdui-icon>
                下载文件
              </mdui-button>
            </div>
          </div>
        </mdui-card>

        <!-- 批量分享 - 每个项目一个 card -->
        <template v-else>
          <div class="batch-share-header">
            <span class="batch-share-count">共 {{ parseBatchShareContent(fetchedContent).length }} 个项目</span>
          </div>
          <mdui-card
            v-for="(item, index) in parseBatchShareContent(fetchedContent)"
            :key="index"
            class="share-content-card batch-item-card"
          >
            <div class="batch-item-header">
              <span class="batch-item-number">#{{ index + 1 }}</span>
              <mdui-chip size="small" variant="outlined">
                {{ item.type === 'image' ? '图片' : item.type === 'file' ? '文件' : '文本' }}
              </mdui-chip>
            </div>

            <!-- 文本类型 -->
            <div v-if="item.type === 'text'" class="markdown-body" v-html="md.render(item.content)"></div>

            <!-- 图片类型 -->
            <div v-else-if="item.type === 'image'" class="image-share-content">
              <div class="image-grid">
                <!-- 使用预解析的 imageUrls -->
                <template v-if="item.imageUrls && item.imageUrls.length > 0">
                  <img
                    v-for="(url, imgIndex) in item.imageUrls"
                    :key="imgIndex"
                    :src="url"
                    class="share-image"
                    @click="window.open(url, '_blank')"
                  >
                </template>
                <!-- 如果没有解析到 URLs，显示原始内容 -->
                <pre v-else style="white-space: pre-wrap; word-break: break-all;">{{ item.content }}</pre>
              </div>
            </div>

            <!-- 文件类型 -->
            <div v-else-if="item.type === 'file'" class="file-share-content">
              <div class="file-card">
                <mdui-icon name="insert_drive_file" style="font-size: 48px; color: var(--mdui-color-primary);"></mdui-icon>
                <div class="file-info">
                  <span class="file-name">{{ item.content.substring(0, 50) }}{{ item.content.length > 50 ? '...' : '' }}</span>
                </div>
              </div>
            </div>
          </mdui-card>
        </template>
      </div>

      <!-- 底部操作栏 -->
      <div class="share-overlay-footer">
        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
          <mdui-button v-if="fetchedType === 'text'" variant="filled" @click="copyContent">
            <mdui-icon slot="icon" name="content_copy"></mdui-icon>
            复制内容
          </mdui-button>
          <span v-if="shareExpiresAt" style="font-size: 12px; color: var(--mdui-color-on-surface-variant);">
            过期时间: {{ formatDate(shareExpiresAt) }}
          </span>
        </div>
      </div>
    </div>

    <!-- 提取区域 -->
    <div v-else class="section">
      <mdui-card class="fetch-card">
        <h2 class="title">获取分享</h2>
        <p class="subtitle">输入5位提取码或分享码，立即获取分享的内容</p>

        <div style="display: flex; gap: 12px; align-items: stretch;">
          <input
            v-model="fetchCodeModel"
            placeholder="5位提取码 / 分享码"
            maxlength="5"
            class="code-input-native"
            style="
              flex: 1;
              padding: 12px 16px;
              font-size: 16px;
              border: 1px solid var(--mdui-color-outline);
              border-radius: 8px;
              background: var(--mdui-color-surface);
              color: var(--mdui-color-on-surface);
              box-sizing: border-box;
            "
            @keyup.enter="handleFetch"
          />

          <mdui-button
            variant="filled"
            :loading="isFetching"
            @click="handleFetch"
            style="
              --mdui-button-height: 48px;
              border-radius: 8px;
              white-space: nowrap;
            "
          >
            <mdui-icon slot="icon" name="arrow_forward"></mdui-icon>
            获取
          </mdui-button>
        </div>
      </mdui-card>
    </div>

    <!-- 权限错误弹窗 -->
    <mdui-dialog
      :open="showPermissionDialog"
      @close="closePermissionDialog"
      :headline="permissionErrorTitle"
      style="max-width: 400px;"
    >
      <div style="padding: 16px 0;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <mdui-icon name="lock" style="font-size: 48px; color: var(--mdui-color-error);"></mdui-icon>
          <p style="margin: 0; font-size: 14px; color: var(--mdui-color-on-surface-variant);">
            {{ permissionErrorMessage }}
          </p>
        </div>
      </div>
      <mdui-button slot="action" variant="filled" @click="closePermissionDialog">确定</mdui-button>
    </mdui-dialog>

    <!-- 分享不存在弹窗 -->
    <mdui-dialog
      :open="showNotFoundDialog"
      @close="closeNotFoundDialog"
      headline="分享不存在"
      style="max-width: 400px;"
    >
      <div style="padding: 16px 0;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <mdui-icon name="error_outline" style="font-size: 48px; color: var(--mdui-color-error);"></mdui-icon>
          <p style="margin: 0; font-size: 14px; color: var(--mdui-color-on-surface-variant);">
            {{ notFoundMessage }}
          </p>
        </div>
      </div>
      <mdui-button slot="action" variant="filled" @click="closeNotFoundDialog">确定</mdui-button>
    </mdui-dialog>
  </div>
</template>

<style scoped>
.fetch-card {
  padding: 16px;
  text-align: center;
  width: 100%;
  box-sizing: border-box;
}

.title {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--mdui-color-on-surface);
}

.subtitle {
  margin: 0 0 24px 0;
  font-size: 14px;
  color: var(--mdui-color-on-surface-variant);
}

.code-input {
  width: 100%;
  margin-bottom: 16px;
}

.fetch-btn {
  width: 100%;
  --mdui-button-height: 48px;
}

/* 全屏遮罩样式 */
.share-overlay {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  background: #ffffff !important;
  z-index: 9999 !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
}

.share-overlay-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #ffffff;
  border-bottom: 1px solid var(--mdui-color-outline-variant);
  flex-shrink: 0;
}

.share-overlay-header mdui-chip {
  font-family: 'SF Mono', Monaco, monospace;
  font-weight: 600;
}

.close-btn {
  --mdui-button-icon-size: 48px;
}

.share-overlay-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
  background: #ffffff;
}

.share-content-card {
  padding: 20px;
  height: auto;
  background: var(--mdui-color-surface);
  margin-bottom: 16px;
}

/* 批量分享样式 */
.batch-share-header {
  margin-bottom: 16px;
  text-align: center;
}

.batch-share-count {
  font-size: 14px;
  color: var(--mdui-color-on-surface-variant);
  background: var(--mdui-color-surface-container);
  padding: 6px 16px;
  border-radius: 16px;
}

.batch-item-card {
  margin-bottom: 12px;
}

.batch-item-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--mdui-color-surface-container-highest);
}

.batch-item-number {
  font-size: 14px;
  font-weight: 600;
  color: var(--mdui-color-primary);
  font-family: monospace;
}

.share-overlay-footer {
  padding: 16px;
  background: #ffffff;
  border-top: 1px solid var(--mdui-color-outline-variant);
  display: flex;
  justify-content: center;
  flex-shrink: 0;
}

.markdown-body {
  line-height: 1.8;
  color: var(--mdui-color-on-surface);
}

.markdown-body :deep(h1) {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 20px 0;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--mdui-color-outline);
}

.markdown-body :deep(h2) {
  font-size: 22px;
  font-weight: 600;
  margin: 28px 0 14px 0;
  color: var(--mdui-color-primary);
}

.markdown-body :deep(h3) {
  font-size: 18px;
  font-weight: 600;
  margin: 22px 0 10px 0;
}

.markdown-body :deep(p) {
  margin: 0 0 14px 0;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 0 0 14px 0;
  padding-left: 28px;
}

.markdown-body :deep(li) {
  margin: 6px 0;
}

.markdown-body :deep(code) {
  background: var(--mdui-color-surface-container-highest);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 0.9em;
}

.markdown-body :deep(pre) {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 16px 0;
}

.markdown-body :deep(pre code) {
  background: none;
  padding: 0;
  color: inherit;
}

.markdown-body :deep(a) {
  color: var(--mdui-color-primary);
  text-decoration: none;
}

.markdown-body :deep(a:hover) {
  text-decoration: underline;
}

.markdown-body :deep(blockquote) {
  border-left: 4px solid var(--mdui-color-primary);
  margin: 16px 0;
  padding: 12px 20px;
  background: var(--mdui-color-surface-container-lowest);
  font-style: italic;
}

.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid var(--mdui-color-outline);
  padding: 10px 14px;
  text-align: left;
}

.markdown-body :deep(th) {
  background: var(--mdui-color-surface-container-highest);
  font-weight: 600;
}

/* 图片分享样式 */
.image-share-content {
  padding: 16px;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.share-image {
  width: 100%;
  height: 200px;
  object-fit: cover;
  border-radius: 12px;
  cursor: pointer;
  transition: transform 0.2s;
}

.share-image:hover {
  transform: scale(1.02);
}

/* 文件分享样式 */
.file-share-content {
  padding: 32px;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
}

.file-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px;
  background: var(--mdui-color-surface-container);
  border-radius: 16px;
  text-align: center;
}

.file-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-name {
  font-size: 18px;
  font-weight: 500;
  color: var(--mdui-color-on-surface);
  word-break: break-all;
  max-width: 300px;
}

.file-size {
  font-size: 14px;
  color: var(--mdui-color-on-surface-variant);
}
</style>