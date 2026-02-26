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

// 获取相关状态
const fetchCode = ref('')
const isFetching = ref(false)
const fetchError = ref('')
const fetchedContent = ref('')
const fetchedCode = ref('')
const isShareContent = ref(false) // 标记是否是分享内容

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
    fetchedCode.value = shareCode
    console.log('[FetchPage] 内容已设置，长度:', data.content?.length)
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
  fetchedCode.value = ''
  fetchCode.value = ''
  isShareContent.value = false
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
        <mdui-chip icon="tag" variant="outlined">
          {{ isShareContent ? '分享码' : '提取码' }}: {{ fetchedCode }}
        </mdui-chip>
        <mdui-button-icon icon="close" @click="clearFetchedContent" class="close-btn"></mdui-button-icon>
      </div>
      
      <!-- 内容区域 -->
      <div class="share-overlay-content">
        <mdui-card class="share-content-card">
          <div class="markdown-body" v-html="renderedFetchedContent"></div>
        </mdui-card>
      </div>
      
      <!-- 底部操作栏 -->
      <div class="share-overlay-footer">
        <mdui-button variant="filled" @click="copyContent">
          <mdui-icon slot="icon" name="content_copy"></mdui-icon>
          复制内容
        </mdui-button>
      </div>
    </div>

    <!-- 提取区域 -->
    <div v-else class="section">
      <mdui-card class="fetch-card">
        <h2 class="title">获取分享</h2>
        <p class="subtitle">输入5位提取码或分享码，立即获取分享的内容</p>

        <mdui-text-field
          v-model="fetchCode"
          label="5位提取码 / 分享码"
          maxlength="5"
          class="code-input"
          :error="!!fetchError"
          :error-text="fetchError"
        ></mdui-text-field>

        <mdui-button
          variant="filled"
          class="fetch-btn"
          :loading="isFetching"
          @click="handleFetch"
        >
          <mdui-icon slot="icon" name="arrow_forward"></mdui-icon>
          获取
        </mdui-button>
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
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--mdui-color-surface);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.share-overlay-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: var(--mdui-color-surface);
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
}

.share-content-card {
  padding: 20px;
  height: auto;
}

.share-overlay-footer {
  padding: 16px;
  background: var(--mdui-color-surface);
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
</style>