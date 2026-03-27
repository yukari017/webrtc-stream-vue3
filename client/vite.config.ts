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

export default defineConfig({
  plugins: [vue(), removeInlineModulePreload()],
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
            if (id.includes('vue') || id.includes('pinia') || id.includes('vue-router')) {
              return 'vendor'
            }
          }
          if (id.includes('composables')) {
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
