<template>
  <div id="app">
    <header class="app-header">
      <div class="container">
        <h1 class="logo">
          <i class="fas fa-satellite-dish"></i>
          <span class="logo-text">WebRTC 通信系统</span>
        </h1>
        <nav class="nav">
          <router-link to="/" class="nav-link" active-class="active">
            <i class="fas fa-video"></i>
            <span>推流端</span>
          </router-link>
          <router-link to="/viewer" class="nav-link" active-class="active">
            <i class="fas fa-eye"></i>
            <span>观看端</span>
          </router-link>
        </nav>
      </div>
    </header>

    <main class="app-main">
      <router-view />
    </main>

    <footer class="app-footer">
      <div class="container">
        <p class="footer-text">
          <i class="fas fa-code"></i>
          WebRTC 通信系统 &copy; 2026
        </p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<style>
/* 全局样式 - 色彩淡化版 */
:root {
  --primary-color: #5b7cfa;
  --primary-light: #8aa4ff;
  --primary-dark: #4a63d4;
  --secondary-color: #a78bfa;
  --success-color: #34d399;
  --warning-color: #fbbf24;
  --danger-color: #f87171;
  --bg-primary: #f8fafc;
  --bg-secondary: #f1f5f9;
  --bg-card: #ffffff;
  --text-primary: #334155;
  --text-secondary: #64748b;
  --border-color: #e2e8f0;
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.03);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.6;
}

#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* 头部样式 - bilibili 粉色系 */
.app-header {
  background: linear-gradient(135deg, #fb7299 0%, #fc8bab 100%);
  color: white;
  padding: 0;
  box-shadow: var(--shadow-md);
}

.app-header .container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 64px;
}

.logo {
  font-size: 1.5rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.logo i {
  font-size: 1.75rem;
  opacity: 0.9;
}

.logo-text {
  font-weight: 600;
  letter-spacing: 0.5px;
}

.nav {
  display: flex;
  gap: 0.5rem;
}

.nav-link {
  color: rgba(255, 255, 255, 0.85);
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
}

.nav-link:hover {
  color: white;
  background-color: rgba(255, 255, 255, 0.2);
}

.nav-link.active {
  color: white;
  background-color: rgba(255, 255, 255, 0.3);
}

/* 主内容区 */
.app-main {
  flex: 1;
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

/* 页脚样式 */
.app-footer {
  background: var(--bg-secondary);
  padding: 1.25rem 0;
  border-top: 1px solid var(--border-color);
}

.app-footer .container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem;
  text-align: center;
}

.footer-text {
  color: var(--text-secondary);
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.footer-text i {
  color: var(--primary-color);
}

/* 响应式 */
@media (max-width: 768px) {
  .app-header .container {
    padding: 0 1rem;
  }

  .logo-text {
    font-size: 1.25rem;
  }

  .nav-link span {
    display: none;
  }

  .app-main {
    padding: 1rem;
  }
}
</style>
