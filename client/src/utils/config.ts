// WebRTC 信令服务器配置
// 优先使用环境变量，开发环境默认使用当前页面的主机地址

function getDefaultSignalingUrl(): string {
  if (typeof window === 'undefined') return ''
  
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.hostname || 'localhost'
  const port = import.meta.env.DEV ? '3001' : window.location.port || '3001'
  
  return `${protocol}//${host}:${port}`
}

export const SIGNALING_SERVER_URL: string = 
  import.meta.env.VITE_SIGNALING_SERVER_URL || 
  (import.meta.env.DEV ? getDefaultSignalingUrl() : '')

// 调试模式
export const DEBUG: boolean = import.meta.env.VITE_DEBUG === 'true' || import.meta.env.DEV || false

// 房间配置
export const MAX_CLIENTS_PER_ROOM: number = 2

// 重连配置
export const MAX_SIGNALING_RECONNECT: number = 6
export const SIGNALING_RECONNECT_BASE_MS: number = 1000
export const SIGNALING_RECONNECT_WINDOW_MS: number = 5 * 60 * 1000 // 5分钟
export const SIGNALING_HEARTBEAT_INTERVAL: number = 10000 // 10秒

// ICE 重启配置
export const MAX_ICE_RESTART: number = 3
export const ICE_RESTART_DELAY_MS: number = 2000

// 音频设备缓存时间
export const AUDIO_DEVICE_CACHE_MS: number = 5000

// 观看端健康检查配置
export const VIEWER_POLL_INTERVAL: number = 2000
export const DOWNSCALE_COOLDOWN_MS: number = 15000
export const GOOD_COUNT_FOR_UPSCALE: number = 5
export const UPSCALE_COOLDOWN_MS: number = 30000
