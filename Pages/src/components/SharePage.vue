<script setup lang="ts">
import { ref, computed } from 'vue'
import MarkdownIt from 'markdown-it'

const props = defineProps<{
  user: { loggedIn: boolean }
  authLoading: boolean
  baseUrl: string
}>()

const emit = defineEmits(['showToast'])

// API 基础地址
const API_BASE = import.meta.env.VITE_API_URL || 'https://ji-clipboard-worker.olojiang.workers.dev'

// 初始化 markdown-it
const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true
})

// 分享相关状态
const shareContent = ref('')
const shareCode = ref('')
const isSharing = ref(false)
const shareError = ref('')

// 计算属性：预览渲染的 Markdown
const renderedPreview = computed(() => {
  if (!shareContent.value) {
    return '<p style="color: #999; text-align: center; padding: 40px;">开始输入 Markdown 内容...</p>'
  }
  return md.render(shareContent.value)
})

// 处理分享
async function handleShare() {
  if (!shareContent.value.trim()) {
    shareError.value = '请输入要分享的内容'
    return
  }

  shareError.value = ''
  isSharing.value = true
  shareCode.value = ''

  try {
    const sessionId = localStorage.getItem('session_id')
    let url = `${API_BASE}/api/clipboard`
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
        content: shareContent.value,
        type: 'markdown',
        expireHours: 24
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    shareCode.value = data.code
    shareContent.value = ''
  } catch (error) {
    console.error('分享失败:', error)
    shareError.value = (error as Error).message || '分享失败，请重试'
  } finally {
    isSharing.value = false
  }
}

// 复制分享链接
function copyShareLink() {
  if (shareCode.value) {
    const shareLink = `${props.baseUrl}/view.html?code=${shareCode.value}`
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
}

// 清空分享内容
function clearShareContent() {
  shareContent.value = ''
  shareCode.value = ''
  shareError.value = ''
}
</script>

<template>
  <div class="section">
    <!-- 加载中状态 -->
    <mdui-card v-if="authLoading" class="share-card">
      <div class="loading-state">
        <div class="spinner"></div>
        <p>正在检查登录状态...</p>
      </div>
    </mdui-card>

    <!-- 未登录状态 -->
    <mdui-card v-else-if="!user.loggedIn" class="share-card">
      <div class="login-required-state">
        <mdui-icon name="lock" style="font-size: 64px; color: var(--mdui-color-on-surface-variant);"></mdui-icon>
        <h3 class="login-required-title">需要登录</h3>
        <p class="login-required-subtitle">请先使用 GitHub 登录后再分享内容</p>
      </div>
    </mdui-card>

    <!-- 已登录状态 -->
    <mdui-card v-else class="share-card">
      <h2 class="title">分享内容</h2>
      <p class="subtitle">输入 Markdown 内容，生成分享码</p>

      <!-- 分享成功状态 -->
      <div v-if="shareCode" class="success-state">
        <mdui-icon name="check_circle" style="font-size: 64px; color: var(--mdui-color-primary);"></mdui-icon>
        <h3 class="success-title">分享成功！</h3>
        <p class="success-subtitle">您的分享链接</p>
        <div class="share-link-display">{{ baseUrl }}/view.html?code={{ shareCode }}</div>
        <div class="success-actions">
          <mdui-button variant="filled" @click="copyShareLink">
            <mdui-icon slot="icon" name="content_copy"></mdui-icon>
            复制分享链接
          </mdui-button>
          <mdui-button variant="text" @click="clearShareContent">继续分享</mdui-button>
        </div>
      </div>

      <!-- 编辑状态 -->
      <template v-else>
        <div class="editor-container">
          <div class="editor-section">
            <label class="section-label">
              <mdui-icon name="edit" style="font-size: 16px;"></mdui-icon>
              编辑
            </label>
            <textarea
              v-model="shareContent"
              class="markdown-editor"
              placeholder="在此输入 Markdown 内容...&#10;支持标题、列表、代码块、链接等格式"
              rows="12"
            ></textarea>
          </div>

          <div class="preview-section">
            <label class="section-label">
              <mdui-icon name="preview" style="font-size: 16px;"></mdui-icon>
              预览
            </label>
            <div class="markdown-preview" v-html="renderedPreview"></div>
          </div>
        </div>

        <div v-if="shareError" class="error-message">
          <mdui-icon name="error" style="font-size: 16px;"></mdui-icon>
          {{ shareError }}
        </div>

        <mdui-button
          variant="filled"
          class="share-btn"
          :loading="isSharing"
          :disabled="!shareContent.trim()"
          @click="handleShare"
        >
          <mdui-icon slot="icon" name="share"></mdui-icon>
          生成分享码
        </mdui-button>
      </template>
    </mdui-card>
  </div>
</template>

<style scoped>
.share-card {
  padding: 16px;
  width: 100%;
  box-sizing: border-box;
}

.loading-state, .login-required-state {
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

.login-required-title, .success-title {
  font-size: 20px;
  font-weight: 600;
  margin: 24px 0 8px 0;
}

.login-required-subtitle, .success-subtitle {
  font-size: 14px;
  color: var(--mdui-color-on-surface-variant);
  margin: 0 0 24px 0;
}

.success-state {
  text-align: center;
  padding: 24px 16px;
}

.share-link-display {
  font-size: 14px;
  font-weight: 500;
  color: var(--mdui-color-primary);
  margin: 16px 0 24px 0;
  padding: 12px 16px;
  background: var(--mdui-color-surface-container-highest);
  border-radius: 8px;
  word-break: break-all;
  font-family: 'SF Mono', Monaco, monospace;
}

.success-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.editor-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

@media (max-width: 768px) {
  .editor-container {
    grid-template-columns: 1fr;
  }
}

.editor-section, .preview-section {
  display: flex;
  flex-direction: column;
}

.section-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--mdui-color-on-surface-variant);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.markdown-editor {
  width: 100%;
  flex: 1;
  min-height: 300px;
  padding: 16px;
  border: 1px solid var(--mdui-color-outline);
  border-radius: 8px;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
  background: var(--mdui-color-surface);
  color: var(--mdui-color-on-surface);
}

.markdown-editor:focus {
  outline: none;
  border-color: var(--mdui-color-primary);
}

.markdown-preview {
  flex: 1;
  min-height: 300px;
  padding: 16px;
  border: 1px solid var(--mdui-color-outline);
  border-radius: 8px;
  background: var(--mdui-color-surface);
  overflow-y: auto;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--mdui-color-error);
  font-size: 14px;
  margin-bottom: 16px;
  padding: 12px;
  background: var(--mdui-color-error-container);
  border-radius: 8px;
}

.share-btn {
  width: 100%;
  --mdui-button-height: 48px;
}
</style>