<script setup lang="ts">
import { ref } from 'vue'

// 当前页面标签
const currentTab = ref('fetch')

// 写死的数据
const code = ref('')
const recentClips = ref([
  {
    id: 1,
    type: 'text',
    title: 'Project requirements.txt',
    subtitle: '2小时前获取 • 提取码: 48291',
    icon: 'description',
    expired: false
  },
  {
    id: 2,
    type: 'link',
    title: 'https://github.com/desi...',
    subtitle: '昨天获取 • 提取码: 11094',
    icon: 'link',
    expired: false
  },
  {
    id: 3,
    type: 'image',
    title: 'screenshot_2023.png',
    subtitle: '2天前过期',
    icon: 'image',
    expired: true
  }
])

function handleFetch() {
  alert(`正在获取: ${code.value || '空'}`)
}

function handleShare() {
  alert('生成分享码!')
}

function clearAll() {
  recentClips.value = []
}

function switchTab(tab: string) {
  currentTab.value = tab
}
</script>

<template>
  <div class="app">
    <!-- 顶部导航栏 -->
    <mdui-top-app-bar class="app-bar">
      <mdui-button-icon icon="cloud"></mdui-button-icon>
      <mdui-top-app-bar-title>云剪贴板</mdui-top-app-bar-title>
      <mdui-button-icon icon="account_circle"></mdui-button-icon>
    </mdui-top-app-bar>

    <!-- 主内容区 -->
    <main class="main-content">
      
      <!-- 获取页面 -->
      <template v-if="currentTab === 'fetch'">
        <!-- 提取区域 -->
        <div class="section">
          <mdui-card class="fetch-card">
            <h2 class="title">提取剪贴板</h2>
            <p class="subtitle">输入5位提取码，立即获取分享的内容</p>
            
            <mdui-text-field 
              v-model="code"
              label="5位提取码"
              maxlength="5"
              class="code-input"
            ></mdui-text-field>
            
            <mdui-button 
              variant="filled"
              class="fetch-btn"
              @click="handleFetch"
            >
              <mdui-icon slot="icon" name="arrow_forward"></mdui-icon>
              提取
            </mdui-button>
          </mdui-card>
        </div>

        <!-- 最近剪贴板区域 -->
        <div class="section">
          <mdui-card class="recent-card">
            <div class="recent-header">
              <span class="recent-title">最近剪贴板</span>
              <mdui-button 
                variant="text"
                @click="clearAll"
              >
                清空全部
              </mdui-button>
            </div>
            
            <mdui-list class="clips-list">
              <mdui-list-item
                v-for="clip in recentClips"
                :key="clip.id"
                :headline="clip.title"
                :description="clip.subtitle"
                :disabled="clip.expired"
                :icon="clip.icon"
                end-icon="more_vert"
              >
              </mdui-list-item>
            </mdui-list>
            
            <div v-if="recentClips.length === 0" class="empty-state">
              <mdui-icon name="inbox"></mdui-icon>
              <p>暂无最近剪贴板</p>
            </div>
          </mdui-card>
        </div>
      </template>

      <!-- 分享页面 -->
      <template v-if="currentTab === 'share'">
        <div class="section">
          <mdui-card class="placeholder-card">
            <mdui-icon name="share" style="font-size: 48px; opacity: 0.5;"></mdui-icon>
            <p>分享功能开发中...</p>
          </mdui-card>
        </div>
      </template>

      <!-- 我的页面 -->
      <template v-if="currentTab === 'profile'">
        <div class="section">
          <mdui-card class="placeholder-card">
            <mdui-icon name="person" style="font-size: 48px; opacity: 0.5;"></mdui-icon>
            <p>个人中心开发中...</p>
          </mdui-card>
        </div>
      </template>
    </main>

    <!-- 底部导航栏 -->
    <mdui-navigation-bar 
      class="bottom-nav"
      :value="currentTab"
      @change="(e: any) => switchTab(e.target.value)"
    >
      <mdui-navigation-bar-item icon="download" value="fetch">
        获取
      </mdui-navigation-bar-item>
      
      <mdui-navigation-bar-item icon="share" value="share">
        分享
      </mdui-navigation-bar-item>
      
      <mdui-navigation-bar-item icon="person" value="profile">
        我的
      </mdui-navigation-bar-item>
    </mdui-navigation-bar>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  background: var(--mdui-color-surface-container-low);
  padding-bottom: 80px;
}

.app-bar {
  position: sticky;
  top: 0;
  z-index: 100;
}

.main-content {
  padding: 16px;
  max-width: 600px;
  margin: 0 auto;
}

.section {
  margin-bottom: 16px;
}

/* Fetch Card */
.fetch-card {
  padding: 24px;
  text-align: center;
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

/* Recent Card */
.recent-card {
  padding: 16px;
}

.recent-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding: 0 8px;
}

.recent-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--mdui-color-on-surface-variant);
  letter-spacing: 1px;
}

.clips-list {
  padding: 0;
}

.empty-state {
  text-align: center;
  padding: 32px;
  color: var(--mdui-color-on-surface-variant);
}

.empty-state mdui-icon {
  font-size: 48px;
  margin-bottom: 8px;
  opacity: 0.5;
}

/* Placeholder Card */
.placeholder-card {
  padding: 64px 24px;
  text-align: center;
  color: var(--mdui-color-on-surface-variant);
}

.placeholder-card p {
  margin-top: 16px;
  font-size: 16px;
}

/* Bottom Navigation */
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
}
</style>
