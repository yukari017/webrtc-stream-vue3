import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue'),
    meta: { title: 'WebRTC 推流端' }
  },
  {
    path: '/viewer',
    name: 'Viewer',
    component: () => import('../views/Viewer.vue'),
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
