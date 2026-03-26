import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import Home from '../views/Home.vue'
import Viewer from '../views/Viewer.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: Home,
    meta: { title: 'WebRTC 推流端' }
  },
  {
    path: '/viewer',
    name: 'Viewer',
    component: Viewer,
    meta: { title: 'WebRTC 观看端' }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, _from, next) => {
  document.title = (to.meta.title as string) || 'WebRTC 信令系统'
  next()
})

export default router
