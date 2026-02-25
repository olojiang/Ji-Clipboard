import { createApp } from 'vue'
import App from './App.vue'
import { APP_VERSION, BUILD_TIME } from './version'

// MDUI: 导入 CSS 和 JS
import 'mdui/mdui.css'
import 'mdui'

// 创建 Vue 应用
createApp(App).mount('#app')

// 页面加载 1 秒后打印版本信息
setTimeout(() => {
  console.log('%c☁️ 云剪贴板', 'font-size: 24px; font-weight: bold; color: #6750A4;')
  console.log('%c版本: ' + APP_VERSION, 'font-size: 14px; color: #666;')
  console.log('%c构建时间: ' + BUILD_TIME, 'font-size: 12px; color: #999;')
  console.log('%cGitHub: https://github.com/olojiang/Ji-Clipboard', 'font-size: 12px; color: #6750A4;')
}, 1000)
