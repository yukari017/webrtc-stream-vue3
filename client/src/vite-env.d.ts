/// <reference types="vite/client" />

/**
 * 环境变量类型定义
 * 确保 import.meta.env 的类型安全
 */

interface ImportMetaEnv {
  /** 信令服务器 WebSocket URL */
  readonly VITE_SIGNALING_SERVER_URL: string
  
  /** 调试模式开关 */
  readonly VITE_DEBUG: 'true' | 'false'
  
  /** 应用版本（可选） */
  readonly VITE_APP_VERSION?: string
  
  /** 构建时间（可选） */
  readonly VITE_BUILD_TIME?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}
