import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

// 样式引入顺序：变量 → 基础 → 组件 → 页面
import './styles/variables.css'
import './styles/base.css'
import './styles/components.css'
import './styles/common.css'

// 移动端样式按需加载
if (/Mobi|Android|iPhone|iPad|iPod|Windows Phone|webOS|BlackBerry/i.test(navigator.userAgent) ||
    Math.min(window.innerWidth, window.innerHeight) < 768) {
  import('./styles/mobile-common.css')
}

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
