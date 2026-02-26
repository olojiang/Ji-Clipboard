<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits(['close', 'add-text', 'add-images'])

const API_BASE = import.meta.env.VITE_API_URL || 'https://ji-clipboard-worker.olojiang.workers.dev'

// 类型选择：text 或 image
const activeTab = ref('text')

// 文本输入
const textInput = ref('')
const textError = ref('')

// 图片上传
const selectedImages = ref<File[]>([])
const imagePreviewUrls = ref<string[]>([])
const isUploading = ref(false)
const uploadError = ref('')
const uploadProgress = ref(0)

// 存储空间信息
const storageInfo = ref<{
  totalSize: number
  maxSize: number
  images: any[]
} | null>(null)

// 计算已用空间百分比
const storagePercent = computed(() => {
  if (!storageInfo.value) return 0
  return Math.round((storageInfo.value.totalSize / storageInfo.value.maxSize) * 100)
})

// 计算剩余空间
const remainingSpace = computed(() => {
  if (!storageInfo.value) return 200 * 1024 * 1024
  return storageInfo.value.maxSize - storageInfo.value.totalSize
})

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 获取存储信息
async function fetchStorageInfo() {
  try {
    const sessionId = localStorage.getItem('session_id')
    let url = `${API_BASE}/api/storage`
    if (sessionId) {
      url += `?session=${sessionId}`
    }

    const response = await fetch(url, {
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    })

    if (response.ok) {
      storageInfo.value = await response.json()
    }
  } catch (error) {
    console.error('获取存储信息失败:', error)
  }
}

// 处理文件选择
function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files) return

  const files = Array.from(input.files)
  const maxSize = 5 * 1024 * 1024 // 5MB
  
  for (const file of files) {
    if (file.size > maxSize) {
      uploadError.value = `文件 ${file.name} 超过 5MB 限制`
      continue
    }
    
    if (!file.type.startsWith('image/')) {
      uploadError.value = `文件 ${file.name} 不是图片`
      continue
    }

    // 检查剩余空间
    if (file.size > remainingSpace.value) {
      uploadError.value = '存储空间不足'
      continue
    }

    selectedImages.value.push(file)
    imagePreviewUrls.value.push(URL.createObjectURL(file))
  }

  input.value = ''
}

// 移除已选图片
function removeImage(index: number) {
  URL.revokeObjectURL(imagePreviewUrls.value[index])
  selectedImages.value.splice(index, 1)
  imagePreviewUrls.value.splice(index, 1)
}

// 上传图片
async function uploadImages() {
  if (selectedImages.value.length === 0) {
    uploadError.value = '请选择至少一张图片'
    return
  }

  isUploading.value = true
  uploadError.value = ''
  uploadProgress.value = 0

  const uploadedUrls: string[] = []

  try {
    for (let i = 0; i < selectedImages.value.length; i++) {
      const file = selectedImages.value[i]
      const formData = new FormData()
      formData.append('image', file)

      const sessionId = localStorage.getItem('session_id')
      let url = `${API_BASE}/api/upload-image`
      if (sessionId) {
        url += `?session=${sessionId}`
      }

      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '上传失败')
      }

      const data = await response.json()
      uploadedUrls.push(data.image.url)
      uploadProgress.value = Math.round(((i + 1) / selectedImages.value.length) * 100)
    }

    emit('add-images', uploadedUrls)
    handleClose()
  } catch (error: any) {
    uploadError.value = error.message || '上传失败，请重试'
  } finally {
    isUploading.value = false
  }
}

// 添加文本剪贴板
function addTextClipboard() {
  if (!textInput.value || !textInput.value.trim()) {
    textError.value = '请输入内容'
    return
  }

  emit('add-text', textInput.value.trim())
  handleClose()
}

// 重置表单
function resetForm() {
  textInput.value = ''
  textError.value = ''
  selectedImages.value = []
  imagePreviewUrls.value.forEach(url => URL.revokeObjectURL(url))
  imagePreviewUrls.value = []
  uploadError.value = ''
  uploadProgress.value = 0
  activeTab.value = 'text'
}

// 关闭弹窗
function handleClose() {
  resetForm()
  emit('close')
}

// 切换标签时获取存储信息
function switchTab(tab: string) {
  activeTab.value = tab
  if (tab === 'image') {
    fetchStorageInfo()
  }
}
</script>

<template>
  <mdui-dialog
    :open="open"
    @close="handleClose"
    style="max-width: 600px; width: 90%;"
  >
    <div slot="headline" style="font-size: 20px; font-weight: 600;">添加剪贴板</div>

    <div style="padding: 16px 0;">
      <!-- 类型选择标签 -->
      <mdui-tabs :value="activeTab" @change="(e: any) => switchTab(e.target.value)" style="margin-bottom: 16px;">
        <mdui-tab value="text">
          <mdui-icon name="text_fields" style="margin-right: 8px;"></mdui-icon>
          文本
        </mdui-tab>
        <mdui-tab value="image">
          <mdui-icon name="image" style="margin-right: 8px;"></mdui-icon>
          图片
        </mdui-tab>
      </mdui-tabs>

      <!-- 文本输入 -->
      <div v-if="activeTab === 'text'">
        <textarea
          v-model="textInput"
          class="clipboard-dialog-textarea"
          placeholder="在此输入剪贴板内容..."
          rows="5"
        ></textarea>
        <div v-if="textError" class="error-message" style="margin-top: 8px;">
          <mdui-icon name="error" style="font-size: 16px;"></mdui-icon>
          {{ textError }}
        </div>
      </div>

      <!-- 图片上传 -->
      <div v-if="activeTab === 'image'">
        <!-- 存储空间信息 -->
        <div v-if="storageInfo" style="margin-bottom: 16px; padding: 12px; background: var(--mdui-color-surface-container); border-radius: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 14px;">存储空间</span>
            <span style="font-size: 12px; color: var(--mdui-color-on-surface-variant);">
              {{ formatFileSize(storageInfo.totalSize) }} / {{ formatFileSize(storageInfo.maxSize) }}
            </span>
          </div>
          <mdui-linear-progress :value="storagePercent / 100" style="width: 100%;"></mdui-linear-progress>
          <div v-if="storagePercent >= 90" style="margin-top: 4px; font-size: 12px; color: var(--mdui-color-error);">
            存储空间不足，请删除一些图片
          </div>
        </div>

        <!-- 文件选择 -->
        <div v-if="selectedImages.length < 10" style="margin-bottom: 16px;">
          <label class="upload-button">
            <mdui-icon name="add_photo_alternate"></mdui-icon>
            <span>选择图片</span>
            <input
              type="file"
              accept="image/*"
              multiple
              style="display: none;"
              @change="handleFileSelect"
            >
          </label>
          <div style="font-size: 12px; color: var(--mdui-color-on-surface-variant); margin-top: 8px;">
            支持 JPG、PNG、GIF 格式，单张不超过 5MB，最多 10 张
          </div>
        </div>

        <!-- 已选图片预览 -->
        <div v-if="selectedImages.length > 0" class="image-preview-grid">
          <div v-for="(url, index) in imagePreviewUrls" :key="index" class="image-preview-item">
            <img :src="url" :alt="selectedImages[index].name">
            <div class="image-info">
              <span class="image-name">{{ selectedImages[index].name }}</span>
              <span class="image-size">{{ formatFileSize(selectedImages[index].size) }}</span>
            </div>
            <mdui-button-icon
              icon="close"
              class="remove-image-btn"
              @click="removeImage(index)"
            ></mdui-button-icon>
          </div>
        </div>

        <!-- 上传进度 -->
        <div v-if="isUploading" style="margin-top: 16px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span>上传中...{{ uploadProgress }}%</span>
          </div>
          <mdui-linear-progress :value="uploadProgress / 100" style="width: 100%;"></mdui-linear-progress>
        </div>

        <div v-if="uploadError" class="error-message" style="margin-top: 8px;">
          <mdui-icon name="error" style="font-size: 16px;"></mdui-icon>
          {{ uploadError }}
        </div>
      </div>
    </div>

    <div slot="action">
      <mdui-button variant="text" @click="handleClose">取消</mdui-button>
      <mdui-button
        v-if="activeTab === 'text'"
        variant="filled"
        @click="addTextClipboard"
      >
        添加
      </mdui-button>
      <mdui-button
        v-else
        variant="filled"
        :loading="isUploading"
        :disabled="selectedImages.length === 0 || storagePercent >= 100"
        @click="uploadImages"
      >
        上传 {{ selectedImages.length > 0 ? `(${selectedImages.length}张)` : '' }}
      </mdui-button>
    </div>
  </mdui-dialog>
</template>

<style scoped>
.clipboard-dialog-textarea {
  width: 100%;
  min-height: 120px;
  padding: 12px 16px;
  border: 1px solid var(--mdui-color-outline);
  border-radius: 8px;
  font-family: inherit;
  font-size: 16px;
  line-height: 1.5;
  resize: vertical;
  background: var(--mdui-color-surface);
  color: var(--mdui-color-on-surface);
  box-sizing: border-box;
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

.upload-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  border: 2px dashed var(--mdui-color-outline);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--mdui-color-on-surface-variant);
}

.upload-button:hover {
  border-color: var(--mdui-color-primary);
  color: var(--mdui-color-primary);
}

.upload-button mdui-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.image-preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.image-preview-item {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  background: var(--mdui-color-surface-container);
}

.image-preview-item img {
  width: 100%;
  height: 120px;
  object-fit: cover;
}

.image-info {
  padding: 8px;
  font-size: 12px;
}

.image-name {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--mdui-color-on-surface);
}

.image-size {
  display: block;
  color: var(--mdui-color-on-surface-variant);
  margin-top: 2px;
}

.remove-image-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  --mdui-button-icon-size: 28px;
}
</style>