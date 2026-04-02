/**
 * WebRTC Stream Vue3 - 公共 API 导出
 *
 * 本文件作为 TypeDoc API 文档的入口点。
 * 所有对外暴露的 composables、stores、utils、types 都应在此导出。
 */

// ─── Composables ─────────────────────────────────────────────────────────

export { useWebRTC } from './composables/useWebRTC'
export { useMediaStream } from './composables/useMediaStream'
export { useSignaling } from './composables/useSignaling'
export { useChat } from './composables/useChat'

// ─── Stores ─────────────────────────────────────────────────────────────

export { useWebRTCStore } from './stores'
export type {
  WebRTCSettings,
  PerformanceData,
  StatusHistoryItem,
  AudioDevice,
  LocalChatMessage,
  QualityTier,
  AdaptiveBitrateState
} from './stores'

// ─── Utils ──────────────────────────────────────────────────────────────

export { eventBus } from './utils/eventBus'
export type { EventMap } from './types'

// ─── Types ─────────────────────────────────────────────────────────────

export type {
  SignalingMessage,
  ChatMessage
} from './types/webrtc'

export type { WebRTCState } from './stores'
export type { EventCallback } from './utils/eventBus'
