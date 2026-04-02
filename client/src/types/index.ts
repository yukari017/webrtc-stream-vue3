/**
 * 类型统一导出
 * 所有公共类型从这里导入，避免循环依赖
 */

// WebRTC 核心类型
export type {
  WebRTCSettings,
  PerformanceData,
  StatusHistoryItem,
  AudioDevice,
  SignalingMessage,
  ChatMessage,
  LocalChatMessage
} from './webrtc'

// ─── Store 相关类型 ─────────────────────────────────────────────────────

/** 画质质量等级 */
export type QualityTier = 'low' | 'medium' | 'high'

export interface AdaptiveBitrateState {
  enabled: boolean
  currentBitrateKbps: number
  qualityTier: QualityTier
}

// ─── Event Bus 类型定义 ─────────────────────────────────────────────────

/**
 * 全局事件映射
 * 用于 eventBus 的类型安全
 */
export interface EventMap {
  // 信令相关
  'signaling-connected': void
  'room-ready': void
  'peer-disconnected': void
  'connection-closed': void

  // 消息相关
  'message': Record<string, unknown>
  'data-channel-message': import('./webrtc').ChatMessage
}

// ─── DataChannel 消息类型 ───────────────────────────────────────────────

export type DataChannelMessage =
  | { type: 'datachannel-ready' }
  | { type: 'chat'; text: string; sender: string; timestamp: number }

// ─── WebRTC 统计数据类型 ───────────────────────────────────────────────

export type StatsReportType =
  | 'outbound-rtp'
  | 'inbound-rtp'
  | 'remote-inbound-rtp'
  | 'candidate-pair'

export interface ExtendedRTCStats extends RTCStats {
  framesPerSecond?: number
  packetsLost?: number
  packetsReceived?: number
  roundTripTime?: number
  currentRoundTripTime?: number
  bytesSent?: number
  bytesReceived?: number
}
