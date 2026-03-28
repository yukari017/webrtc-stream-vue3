import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

// 样式引入顺序：变量 → 基础 → 组件 → 页面 → 移动端
import './styles/variables.css'
import './styles/base.css'
import './styles/components.css'
import './styles/common.css'
import './styles/mobile-common.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
