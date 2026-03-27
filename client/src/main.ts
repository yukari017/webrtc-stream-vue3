import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/variables.css'
import './assets/css/main.css'
import './styles/common.css'
import './styles/mobile-common.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
