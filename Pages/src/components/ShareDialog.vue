<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  open: boolean
  content?: string
  itemIds?: string[]
  items?: Array<{ type: string; content: string }>  // 新增：直接传入 items
  type?: string
  fileInfo?: any
}>()

const emit = defineEmits(['close', 'shareCreated', 'showToast'])

const API_BASE = import.meta.env.VITE_API_URL || 'https://ji-clipboard-worker.olojiang.workers.dev'

// 分享设置
const expireOptions = [
  { label: '24小时', value: 24 },
  { label: '7天', value: 168 },
  { label: '30天', value: 720 },
  { label: '永久', value: 365 * 24 },
]

const visibilityOptions = [
  { label: '所有人可查看', value: 'public', description: '无需登录即可访问' },
  { label: '登录用户可查看', value: 'authenticated', description: '需要登录才能访问' },
  { label: '仅自己可查看', value: 'private', description: '只有你自己能访问' },
]

const selectedExpire = ref(24)
const selectedVisibility = ref('public')
const isCreating = ref(false)
const shareResult = ref<{
  id: string
  shareUrl: string
  expiresAt: number
} | null>(null)
const error = ref('')

// 格式化日期
function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 获取文本内容的简短显示
function getTextPreview(content: string, maxLength: number = 20): string {
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
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
}

// 创建分享
async function createShare() {
  // 检查是否有 content 或 itemIds
  console.log('[ShareDialog] createShare 被调用')
  console.log('[ShareDialog] props.content:', props.content)
  console.log('[ShareDialog] props.itemIds:', props.itemIds)
  console.log('[ShareDialog] props.items:', props.items)
  
  if (!props.content && (!props.itemIds || props.itemIds.length === 0)) {
    console.log('[ShareDialog] 没有内容，返回')
    return
  }

  isCreating.value = true
  error.value = ''
  shareResult.value = null

  try {
    const sessionId = localStorage.getItem('session_id')
    let url = `${API_BASE}/api/shares`
    if (sessionId) {
      url += `?session=${sessionId}`
    }

    // 构建请求体
    const body: any = {
      visibility: selectedVisibility.value,
      expireHours: selectedExpire.value,
    }

    // 优先使用 itemIds（新格式）
    if (props.itemIds && props.itemIds.length > 0) {
      body.itemIds = props.itemIds
      body.type = props.type || 'text'
    } else {
      // 兼容旧格式
      body.content = props.content
      body.type = props.type || 'text'
      body.fileInfo = props.fileInfo || null
    }

    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    shareResult.value = {
      id: data.share.id,
      shareUrl: data.share.shareUrl,
      expiresAt: data.share.expiresAt,
    }
    emit('shareCreated', data.share)
  } catch (err) {
    console.error('创建分享失败:', err)
    error.value = (err as Error).message || '创建分享失败，请重试'
  } finally {
    isCreating.value = false
  }
}

// 复制分享链接
function copyShareUrl() {
  if (!shareResult.value) return
  
  navigator.clipboard.writeText(shareResult.value.shareUrl).then(() => {
    emit('showToast', '分享链接已复制')
  }).catch(() => {
    const input = document.createElement('input')
    input.value = shareResult.value!.shareUrl
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    emit('showToast', '分享链接已复制')
  })
}

// 复制分享码
function copyShareCode() {
  console.log('[ShareDialog] copyShareCode 被调用')
  console.log('[ShareDialog] shareResult:', shareResult.value)
  if (!shareResult.value) {
    console.log('[ShareDialog] shareResult 为空')
    return
  }
  
  const codeToCopy = shareResult.value.id
  console.log('[ShareDialog] 准备复制分享码:', codeToCopy, '类型:', typeof codeToCopy)
  
  navigator.clipboard.writeText(codeToCopy).then(() => {
    console.log('[ShareDialog] 复制成功:', codeToCopy)
    emit('showToast', '分享码已复制: ' + codeToCopy)
  }).catch((err) => {
    console.log('[ShareDialog] 复制失败:', err)
    const input = document.createElement('input')
    input.value = codeToCopy
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    emit('showToast', '分享码已复制: ' + codeToCopy)
  })
}

// 复制分享信息（包含链接和说明）
function copyShareInfo() {
  if (!shareResult.value) return
  
  const visibilityText = visibilityOptions.find(v => v.value === selectedVisibility.value)?.label
  const expireText = expireOptions.find(e => e.value === selectedExpire.value)?.label
  
  const info = `分享内容：${props.content?.substring(0, 50)}${props.content && props.content.length > 50 ? '...' : ''}
分享码：${shareResult.value.id}
链接：${shareResult.value.shareUrl}
权限：${visibilityText}
有效期：${expireText}
过期时间：${formatDate(shareResult.value.expiresAt)}`
  
  navigator.clipboard.writeText(info).then(() => {
    // 可以显示一个提示
  }).catch(() => {
    const input = document.createElement('input')
    input.value = info
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
  })
}

// 关闭弹窗并重置状态
function handleClose() {
  shareResult.value = null
  error.value = ''
  selectedExpire.value = 24
  selectedVisibility.value = 'public'
  emit('close')
}
</script>

<template>
  <mdui-dialog
    :open="open"
    @close="handleClose"
    style="max-width: 600px; width: 90%; max-height: 90vh;"
  >
    <div slot="headline" style="font-size: 20px; font-weight: 600;">
      分享剪贴板
    </div>
    
    <div style="padding: 16px 0;">
      <!-- 内容预览 - 使用 items 数组（新格式）或 content 字符串（旧格式） -->
      <div style="margin-bottom: 24px;">
        <div style="font-size: 12px; color: var(--mdui-color-on-surface-variant); margin-bottom: 8px;">
          分享内容
        </div>
        <!-- 调试信息 -->
        <div v-if="true" style="font-size: 10px; color: #999; margin-bottom: 8px;">
          items: {{ items?.length || 0 }}, content: {{ content ? '有' : '无' }}
        </div>
        <!-- 新格式：使用 items 数组 -->
        <div v-if="items && items.length > 0" style="
          padding: 12px 16px;
          background: var(--mdui-color-surface-container);
          border-radius: 8px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        ">
          <template v-for="(item, index) in items" :key="index">
            <!-- 文本内容 - 直接显示 -->
            <span v-if="item.type === 'text'" style="font-size: 14px; color: var(--mdui-color-on-surface);">
              {{ getTextPreview(item.content, 20) }}
            </span>
            
            <!-- 图片 -->
            <mdui-chip v-else-if="item.type === 'image'" size="small" variant="outlined" style="--mdui-chip-outline-color: var(--mdui-color-tertiary-container); color: var(--mdui-color-tertiary);">
              <mdui-icon slot="icon" name="image"></mdui-icon>
              图片
            </mdui-chip>
            
            <!-- 文件 -->
            <mdui-chip v-else-if="item.type === 'file'" size="small" variant="outlined" style="--mdui-chip-outline-color: var(--mdui-color-secondary-container); color: var(--mdui-color-secondary);">
              <mdui-icon slot="icon" name="insert_drive_file"></mdui-icon>
              {{ getTextPreview(item.content, 10) }}
            </mdui-chip>
          </template>
        </div>
        <!-- 旧格式：使用 content 字符串 -->
        <div v-else style="
          padding: 12px 16px;
          background: var(--mdui-color-surface-container);
          border-radius: 8px;
          font-size: 14px;
          line-height: 1.5;
          max-height: 100px;
          overflow-y: auto;
          word-break: break-word;
        ">
          {{ content }}
        </div>
      </div>

      <!-- 分享设置 -->
      <div v-if="!shareResult" style="margin-bottom: 24px;">
        <!-- 有效期设置 -->
        <div style="margin-bottom: 24px;">
          <div style="font-size: 14px; font-weight: 500; margin-bottom: 12px;">
            有效期
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <mdui-chip
              v-for="option in expireOptions"
              :key="option.value"
              :selected="selectedExpire === option.value"
              @click="selectedExpire = option.value"
              style="cursor: pointer;"
            >
              {{ option.label }}
            </mdui-chip>
          </div>
        </div>

        <!-- 权限设置 -->
        <div>
          <div style="font-size: 14px; font-weight: 500; margin-bottom: 12px;">
            查看权限
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <mdui-radio
              v-for="option in visibilityOptions"
              :key="option.value"
              :checked="selectedVisibility === option.value"
              @change="selectedVisibility = option.value"
            >
              <div style="display: flex; flex-direction: column;">
                <span style="font-size: 14px;">{{ option.label }}</span>
                <span style="font-size: 12px; color: var(--mdui-color-on-surface-variant);">
                  {{ option.description }}
                </span>
              </div>
            </mdui-radio>
          </div>
        </div>
      </div>

      <!-- 分享结果 -->
      <div v-else style="margin-bottom: 24px;">
        <div style="
          padding: 16px;
          background: var(--mdui-color-primary-container);
          border-radius: 12px;
          margin-bottom: 16px;
        ">
          <div style="font-size: 14px; font-weight: 500; margin-bottom: 8px; color: var(--mdui-color-on-primary-container);">
            分享链接已创建
          </div>
          <div style="
            padding: 12px;
            background: var(--mdui-color-surface);
            border-radius: 8px;
            font-size: 13px;
            word-break: break-all;
            font-family: monospace;
            margin-bottom: 8px;
          ">
            {{ shareResult.shareUrl }}
          </div>
          <div style="font-size: 12px; color: var(--mdui-color-on-primary-container);">
            过期时间：{{ formatDate(shareResult.expiresAt) }}
          </div>
        </div>

        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 16px;">
          <mdui-button variant="outlined" @click="copyShareInfo" style="flex: 1;">
            <mdui-icon slot="icon" name="content_copy"></mdui-icon>
            复制完整信息
          </mdui-button>
        </div>
      </div>

      <!-- 错误提示 -->
      <div v-if="error" style="
        padding: 12px 16px;
        background: var(--mdui-color-error-container);
        border-radius: 8px;
        color: var(--mdui-color-on-error-container);
        font-size: 14px;
        margin-bottom: 16px;
      ">
        <mdui-icon name="error" style="margin-right: 8px;"></mdui-icon>
        {{ error }}
      </div>
    </div>

    <div slot="action">
      <mdui-button variant="text" @click="handleClose">
        {{ shareResult ? '关闭' : '取消' }}
      </mdui-button>
      <template v-if="shareResult">
        <mdui-button variant="filled" @click="copyShareCode">
          <mdui-icon slot="icon" name="tag"></mdui-icon>
          复制分享码
        </mdui-button>
        <mdui-button variant="outlined" @click="copyShareUrl">
          <mdui-icon slot="icon" name="link"></mdui-icon>
          复制链接
        </mdui-button>
      </template>
      <mdui-button 
        v-else
        variant="filled" 
        :loading="isCreating"
        @click="createShare"
      >
        创建分享
      </mdui-button>
    </div>
  </mdui-dialog>
</template>