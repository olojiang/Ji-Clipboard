<script setup lang="ts">
import { ref, computed } from 'vue'
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

// 计算属性：渲染获取到的内容
const renderedFetchedContent = computed(() => {
  if (!fetchedContent.value) return ''
  return md.render(fetchedContent.value)
})

// 处理获取剪贴板
async function handleFetch() {
  if (!fetchCode.value || fetchCode.value.length !== 5) {
    fetchError.value = '请输入5位提取码'
    return
  }

  fetchError.value = ''
  isFetching.value = true
  fetchedContent.value = ''

  try {
    const response = await fetch(`${API_BASE}/api/clipboard?code=${fetchCode.value}`, {
      headers: {
        'Accept': 'application/json'
      }
    })

    if (response.status === 404) {
      fetchError.value = '内容不存在或已过期'
      isFetching.value = false
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
    // 跳转到查看页面
    window.location.href = `./view.html?code=${fetchCode.value}`
  } catch (error) {
    console.error('获取失败:', error)
    fetchError.value = '获取失败，请稍后重试'
  } finally {
    isFetching.value = false
  }
}

// 清除获取的内容
function clearFetchedContent() {
  fetchedContent.value = ''
  fetchedCode.value = ''
  fetchCode.value = ''
}
</script>

<template>
  <div class="section">
    <!-- 显示获取到的内容 -->
    <div v-if="fetchedContent" class="section">
      <mdui-card class="content-display-card">
        <div class="content-header">
          <span class="content-code">提取码: {{ fetchedCode }}</span>
          <mdui-button variant="text" @click="clearFetchedContent">返回</mdui-button>
        </div>
        <div class="markdown-body" v-html="renderedFetchedContent"></div>
      </mdui-card>
    </div>

    <!-- 提取区域 -->
    <div v-else class="section">
      <mdui-card class="fetch-card">
        <h2 class="title">获取分享</h2>
        <p class="subtitle">输入5位提取码，立即获取分享的内容</p>

        <mdui-text-field
          v-model="fetchCode"
          label="5位提取码"
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
          提取
        </mdui-button>
      </mdui-card>
    </div>
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

.content-display-card {
  padding: 16px;
}

.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--mdui-color-outline);
  margin-bottom: 24px;
}

.content-code {
  font-size: 14px;
  color: var(--mdui-color-on-surface-variant);
  font-family: 'SF Mono', Monaco, monospace;
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