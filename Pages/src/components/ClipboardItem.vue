<script setup lang="ts">
// 统一剪贴板项渲染组件
// 支持类型：text, image, file

interface ClipboardItem {
  id?: string
  type: 'text' | 'image' | 'file'
  content: string
  fileInfo?: {
    name: string
    size: number
    type: string
    url?: string
  }
  imageInfo?: {
    url: string
    name?: string
    size?: number
  }
  createdAt?: number
}

const props = defineProps<{
  item: ClipboardItem | null | undefined
  showActions?: boolean
  showDate?: boolean
}>()

const emit = defineEmits(['copy', 'delete', 'download'])

// 格式化文件大小
function formatFileSize(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 格式化日期
function formatDate(timestamp?: number): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 解析内容（处理 JSON 字符串）
function parseContent(content: string): any {
  if (!content) return null
  try {
    return JSON.parse(content)
  } catch {
    return content
  }
}

// 获取实际类型（处理大小写）
function getItemType(): string {
  const type = props.item?.type?.toLowerCase()
  if (type === 'image' || type === 'file' || type === 'text') {
    return type
  }
  // 尝试从内容推断类型
  const content = props.item?.content || ''
  
  // 检查是否是图片URL数组
  if (content.startsWith('[') && content.includes('http') && content.includes('ji-clipboard')) {
    return 'image'
  }
  // 检查是否是文件信息JSON
  if ((content.includes('filename') || content.includes('"size"') || content.includes('originalName')) && content.startsWith('{')) {
    return 'file'
  }
  // 如果是纯URL
  if (content.startsWith('http')) {
    // 检查是否是图片URL
    if (content.match(/\.(jpg|jpeg|png|gif|webp|svg)($|\?)/i)) {
      return 'image'
    }
  }
  // 默认为文本
  return 'text'
}

// 获取文本内容
function getTextContent(): string {
  if (getItemType() === 'text') {
    return props.item?.content || ''
  }
  return ''
}

// 获取图片列表
function getImageList(): string[] {
  if (getItemType() === 'image') {
    const parsed = parseContent(props.item?.content)
    if (Array.isArray(parsed)) {
      return parsed
    }
    if (typeof parsed === 'string') {
      return [parsed]
    }
    // 尝试直接解析 content 作为 URL
    if (props.item?.content?.startsWith('http')) {
      return [props.item.content]
    }
  }
  return []
}

// 获取文件信息
function getFileInfo(): { name: string; size: number; url?: string } | null {
  if (getItemType() === 'file') {
    if (props.item?.fileInfo) {
      return props.item.fileInfo
    }
    const parsed = parseContent(props.item?.content)
    if (parsed && typeof parsed === 'object') {
      return {
        name: parsed.name || parsed.filename || '未知文件',
        size: parsed.size || 0,
        url: parsed.url || parsed.downloadUrl
      }
    }
  }
  return null
}

// 复制文本
function copyText() {
  const text = getTextContent()
  if (text) {
    navigator.clipboard.writeText(text)
    emit('copy', text)
  }
}

// 复制图片链接
function copyImageUrl(url: string) {
  navigator.clipboard.writeText(url)
  emit('copy', url)
}

// 下载文件
function downloadFile(url?: string) {
  if (url) {
    emit('download', url)
  }
}

// 删除
function handleDelete() {
  emit('delete', props.item)
}
</script>

<template>
  <div v-if="item" class="clipboard-item">
    <!-- 文本类型（默认） -->
    <div v-if="getItemType() === 'text'" class="item-text">
      <pre>{{ getTextContent() }}</pre>
    </div>

    <!-- 图片类型 -->
    <div v-else-if="getItemType() === 'image'" class="item-images">
      <div v-for="(url, index) in getImageList()" :key="index" class="image-wrapper">
        <img :src="url" :alt="`图片 ${index + 1}`" loading="lazy" @error="$event.target.style.display='none'" />
      </div>
    </div>

    <!-- 文件类型 -->
    <div v-else-if="getItemType() === 'file'" class="item-file">
      <div v-if="getFileInfo()" class="file-info">
        <mdui-icon name="insert_drive_file" class="file-icon"></mdui-icon>
        <div class="file-details">
          <span class="file-name">{{ getFileInfo()?.name }}</span>
          <span class="file-size">{{ formatFileSize(getFileInfo()?.size) }}</span>
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div v-if="showActions" class="item-actions">
      <!-- 文本操作 -->
      <template v-if="getItemType() === 'text'">
        <mdui-button-icon icon="content_copy" title="复制" @click="copyText"></mdui-button-icon>
      </template>

      <!-- 图片操作 -->
      <template v-else-if="getItemType() === 'image'">
        <mdui-button-icon
          v-for="(url, index) in getImageList()"
          :key="index"
          icon="content_copy"
          :title="`复制图片 ${index + 1} 链接`"
          @click="copyImageUrl(url)"
        ></mdui-button-icon>
      </template>

      <!-- 文件操作 -->
      <template v-else-if="getItemType() === 'file'">
        <mdui-button-icon
          icon="download"
          title="下载"
          @click="downloadFile(getFileInfo()?.url)"
        ></mdui-button-icon>
      </template>

      <mdui-button-icon icon="delete" title="删除" style="color: var(--mdui-color-error);" @click="handleDelete"></mdui-button-icon>
    </div>

    <!-- 日期 -->
    <div v-if="showDate && item.createdAt" class="item-date">
      {{ formatDate(item.createdAt) }}
    </div>
  </div>
</template>

<style scoped>
.clipboard-item {
  padding: 12px;
  background: var(--mdui-color-surface-container);
  border-radius: 8px;
}

.item-text pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 14px;
  color: var(--mdui-color-on-surface);
  max-height: 200px;
  overflow-y: auto;
}

.item-images {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.image-wrapper {
  flex: 1;
  min-width: 100px;
  max-width: 200px;
}

.image-wrapper img {
  width: 100%;
  height: 120px;
  object-fit: cover;
  border-radius: 8px;
}

.item-file {
  display: flex;
  align-items: center;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-icon {
  font-size: 40px;
  color: var(--mdui-color-primary);
}

.file-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-name {
  font-size: 14px;
  color: var(--mdui-color-on-surface);
  word-break: break-all;
}

.file-size {
  font-size: 12px;
  color: var(--mdui-color-on-surface-variant);
}

.item-unknown {
  color: var(--mdui-color-error);
}

.item-unknown pre {
  margin: 8px 0 0 0;
  font-size: 12px;
  color: var(--mdui-color-on-surface-variant);
}

.item-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--mdui-color-surface-container-highest);
}

.item-date {
  margin-top: 8px;
  font-size: 12px;
  color: var(--mdui-color-on-surface-variant);
}
</style>
