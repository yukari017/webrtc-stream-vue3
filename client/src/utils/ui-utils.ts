import { DEBUG } from './config'

/** @deprecated 改用 supportsTabAudioCapture */
export function supportsDisplayMedia(): boolean {
  if (typeof window === 'undefined') return false
  return typeof (navigator as Navigator & { mediaDevices?: MediaDevices }).mediaDevices?.getDisplayMedia === 'function'
}

/**
 * HTML 转义
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * 检测浏览器是否支持 getDisplayMedia 捕获标签页音频
 * - 桌面端 Chrome 72+ / Edge 79+ / Opera 支持
 * - Firefox 部分支持（需用户授权标签页音频）
 * - 移动端浏览器（iOS Safari、Android Chrome）均不支持
 */
export function supportsTabAudioCapture(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false

  const w = navigator as Navigator & {
    mediaDevices?: MediaDevices & {
      getDisplayMedia?: (constraints?: object) => Promise<MediaStream>
    }
  }

  // 必须有 getDisplayMedia API
  if (typeof w.mediaDevices?.getDisplayMedia !== 'function') return false

  // 移动端全部不支持
  if (isMobile()) return false

  return true
}

/**
 * 设备类型检测
 */
export function isAndroidTablet(): boolean {
  try {
    const ua = navigator.userAgent || ''
    const isAndroid = /android/i.test(ua)
    const isMobile = /mobile/i.test(ua)
    const largeScreen = Math.max(screen.width, screen.height) >= 600
    return isAndroid && (!isMobile || largeScreen)
  } catch {
    return false
  }
}

export function isMobile(): boolean {
  try {
    const ua = navigator.userAgent || ''
    const isMobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(ua)
    const screenWidth = Math.min(window.innerWidth, window.innerHeight)
    const isMobileScreen = screenWidth > 0 && screenWidth < 768
    return isMobileUA || isMobileScreen
  } catch {
    return false
  }
}

/**
 * 格式化时间
 */
export function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}

/**
 * 生成随机房间号
 */
export function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

/**
 * 摄像头标签映射表
 */
const cameraLabelMap: Record<string, string> = {
  'front': '前置摄像头',
  'back': '后置摄像头',
  'rear': '后置摄像头',
  'environment': '后置摄像头',
  'user': '前置摄像头',
  'default': '默认摄像头',
  'external': '外接摄像头',
  'built-in': '内置摄像头',
  'integrated': '内置摄像头'
}

/**
 * 翻译摄像头设备标签为中文
 */
export function translateCameraLabel(label: string): string {
  if (!label) return '未知摄像头'
  
  const lower = label.toLowerCase()
  
  // 尝试匹配映射表
  for (const [key, value] of Object.entries(cameraLabelMap)) {
    if (lower.includes(key)) return value
  }
  
  // 处理数字编号的情况，如 "camera2 0, facing front"
  if (lower.includes('facing front')) return '前置摄像头'
  if (lower.includes('facing back')) return '后置摄像头'
  
  // 无法识别时返回原标签
  return label
}

interface StatsMonitorOptions {
  direction?: 'outbound' | 'inbound'
  elIds?: {
    bitrate?: string
    resolution?: string
    framerate?: string
    reconnects?: string
  }
  getStream?: () => MediaStream | null
  getReconnects?: () => number
}

interface StatsMonitor {
  start: () => void
  stop: () => void
  update: () => void
}

/**
 * 创建性能监控器
 */
export function createStatsMonitor(
  getPeerConnection: () => RTCPeerConnection | null,
  options: StatsMonitorOptions = {}
): StatsMonitor {
  const {
    direction = 'outbound',
    elIds = {},
    getStream = () => null,
    getReconnects = () => 0
  } = options

  let intervalId: ReturnType<typeof setInterval> | null = null
  let lastBytes = 0
  let lastTimestamp = 0

  const updateElement = (id: string, text: string): void => {
    const el = document.getElementById(id)
    if (el) el.textContent = text
  }

  const updateStats = async (): Promise<void> => {
    try {
      const pc = getPeerConnection()
      if (!pc) return

      const stats = await pc.getStats()
      let videoStats: RTCOutboundRtpStreamStats | RTCInboundRtpStreamStats | null = null

      stats.forEach(report => {
        if (report.type === (direction === 'outbound' ? 'outbound-rtp' : 'inbound-rtp')) {
          if (report.kind === 'video') videoStats = report as RTCOutboundRtpStreamStats | RTCInboundRtpStreamStats
        }
      })

      // 更新视频比特率
      if (videoStats) {
        const bytesKey = direction === 'outbound' ? 'bytesSent' : 'bytesReceived'
        const bytes = (videoStats as Record<string, unknown>)[bytesKey] as number | undefined
        
        if (bytes !== undefined) {
          const now = Date.now()
          if (lastTimestamp > 0) {
            const timeDiff = (now - lastTimestamp) / 1000
            const bytesDiff = bytes - lastBytes
            const bitrate = (bytesDiff * 8) / timeDiff / 1000 // kbps
            
            if (elIds.bitrate) {
              updateElement(elIds.bitrate, `${bitrate.toFixed(1)} kbps`)
            }
          }
          lastBytes = bytes
          lastTimestamp = now
        }
      }

      // 更新分辨率
      if (elIds.resolution) {
        const stream = getStream()
        if (stream) {
          const videoTrack = stream.getVideoTracks()[0]
          if (videoTrack) {
            const settings = videoTrack.getSettings()
            if (settings.width && settings.height) {
              updateElement(elIds.resolution, `${settings.width}×${settings.height}`)
            }
          }
        }
      }

      // 更新帧率
      if (elIds.framerate && videoStats) {
        const fps = (videoStats as Record<string, unknown>).framesPerSecond as number | undefined
        if (fps !== undefined) {
          updateElement(elIds.framerate, `${fps.toFixed(1)} FPS`)
        }
      }

      // 更新重连次数
      if (elIds.reconnects) {
        updateElement(elIds.reconnects, String(getReconnects()))
      }

    } catch (error) {
      if (DEBUG) console.warn('性能监控出错:', error)
    }
  }

  return {
    start() {
      if (intervalId) return
      intervalId = setInterval(updateStats, 1000)
      updateStats()
    },
    
    stop() {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
      lastBytes = 0
      lastTimestamp = 0
    },
    
    update() {
      updateStats()
    }
  }
}
