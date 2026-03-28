import { defineConfig, Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function removeInlineModulePreload(): Plugin {
  return {
    name: 'remove-inline-module-preload',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(
        /<link rel="modulepreload" href="data:[^"]+">/g,
        ''
      )
    }
  }
}

/**
 * 将 CSS 链接转换为异步加载，避免阻塞渲染
 * 使用 preload + onload 切换技术
 */
function asyncCssLoad(): Plugin {
  return {
    name: 'async-css-load',
    enforce: 'post',
    transformIndexHtml(html) {
      // 匹配 <link rel="stylesheet" href="...css"> 并转换为异步加载
      return html.replace(
        /<link rel="stylesheet" (crossorigin\s+)?href="(\/?assets\/css\/[^"]+\.css)">/g,
        (_, crossorigin, href) => {
          const crossoriginAttr = crossorigin || ''
          return `<link rel="preload" ${crossoriginAttr}href="${href}" as="style" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" ${crossoriginAttr}href="${href}"></noscript>`
        }
      )
    }
  }
}

/**
 * 优化 JS 预加载策略
 * - 移除 vendor.js 预加载，让浏览器按需加载
 * - 减少首屏不必要的 JS 下载
 */
function optimizePreload(): Plugin {
  return {
    name: 'optimize-preload',
    enforce: 'post',
    transformIndexHtml(html) {
      // 移除所有 modulepreload 和 preload 标签
      // 让 Vite 的模块系统自动处理依赖
      return html
        .replace(/<link rel="modulepreload"[^>]*>/g, '')
        .replace(/<link rel="preload"[^>]*as="script"[^>]*>/g, '')
    }
  }
}

export default defineConfig({
  plugins: [vue(), removeInlineModulePreload(), asyncCssLoad(), optimizePreload()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: (() => {
    const keyPath = resolve(__dirname, '../server/key.pem')
    const certPath = resolve(__dirname, '../server/cert.pem')
    const hasCerts = existsSync(keyPath) && existsSync(certPath)
    return {
      port: 3000,
      host: '0.0.0.0',
      // 仅在证书文件存在时启用 HTTPS（开发环境），CI/生产构建时跳过
      ...(hasCerts ? {
        https: {
          key: readFileSync(keyPath),
          cert: readFileSync(certPath)
        }
      } : {}),
      proxy: {
        '/ws': {
          target: 'wss://localhost:3001',
          ws: true,
          changeOrigin: true,
          secure: false
        }
      }
    }
  })(),
  build: {
    outDir: '../server/public-dist',
    emptyOutDir: true,
    target: 'es2015',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        passes: 2,
        pure_funcs: ['console.log', 'console.info', 'console.debug']
      },
      mangle: {
        safari10: true
      },
      format: {
        comments: false
      }
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // 将 Vue 相关库拆分，减少单个文件体积
            if (id.includes('vue') || id.includes('vue-router')) {
              return 'vue-vendor'
            }
            if (id.includes('pinia')) {
              return 'pinia-vendor'
            }
            // 其他 node_modules 放入 vendor
            return 'vendor'
          }
          // WebRTC 相关代码单独打包，按需加载
          if (id.includes('composables') || id.includes('utils/adaptiveBitrate') || id.includes('utils/webrtc-utils')) {
            return 'webrtc'
          }
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const name = assetInfo.names?.[0] || ''
          if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(name)) {
            return 'assets/img/[name]-[hash][extname]'
          }
          if (/\.(css)$/i.test(name)) {
            return 'assets/css/[name]-[hash][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        }
      }
    },
    cssCodeSplit: true,
    cssMinify: true,
    sourcemap: false,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1000,
    assetsInlineLimit: 4096
  },
  optimizeDeps: {
    include: ['vue', 'pinia', 'vue-router']
  }
})
