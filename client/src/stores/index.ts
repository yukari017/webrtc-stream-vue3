/**
 * stores/index.ts - WebRTC 状态管理
 *
 * 渐进式重构目标：
 * - 内部按领域分组（连接/媒体/设置/性能/聊天/状态）
 * - 对外 API 保持不变，避免破坏性改动
 *
 * 未来计划：
 * - 子模块（connection/media/performance/chat/status）逐步替代
 * - composables 迁移到对应子 store
 */

import { defineStore } from 'pinia'
import type {
  WebRTCSettings,
  PerformanceData,
  StatusHistoryItem,
  AudioDevice,
  LocalChatMessage
} from '@/types'

// ─── 导出的类型 ─────────────────────────────────────────────────────────

export type { WebRTCSettings, PerformanceData, StatusHistoryItem, AudioDevice, LocalChatMessage }

export type QualityTier = 'low' | 'medium' | 'high'

export interface AdaptiveBitrateState {
  enabled: boolean
  currentBitrateKbps: number
  qualityTier: QualityTier
}

// ─── 内部状态类型（按领域分组）────────────────────────────────────────────

interface ConnectionState {
  isConnected: boolean
  isStreaming: boolean
  roomId: string
  clientId: string
  signalingReconnectAttempts: number
  iceRestartAttempts: number
}

interface MediaState {
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  screenStream: MediaStream | null
  audioStream: MediaStream | null
  selectedAudioDeviceId: string | null
  audioDevices: AudioDevice[]
  peerConnection: RTCPeerConnection | null
  signalingSocket: WebSocket | null
}

interface SettingsState {
  settings: WebRTCSettings
}

interface PerformanceState {
  performance: PerformanceData
  adaptiveBitrate: AdaptiveBitrateState
}

interface ChatState {
  chatMessages: LocalChatMessage[]
  chatNewMessage: string
  chatIsSending: boolean
}

interface StatusState {
  status: string
  statusType: 'info' | 'warning' | 'error' | 'success'
  statusHistory: StatusHistoryItem[]
}

type WebRTCState = ConnectionState & MediaState & SettingsState & PerformanceState & ChatState & StatusState

const MAX_STATUS_HISTORY = 30
const MAX_CHAT_MESSAGES = 100

// ─── Store 定义 ─────────────────────────────────────────────────────────

export const useWebRTCStore = defineStore('webrtc', {
  state: (): WebRTCState => ({
    // 连接状态
    isConnected: false,
    isStreaming: false,
    roomId: '',
    clientId: '',
    signalingReconnectAttempts: 0,
    iceRestartAttempts: 0,

    // 媒体流
    localStream: null,
    remoteStream: null,
    screenStream: null,
    audioStream: null,
    selectedAudioDeviceId: null,
    audioDevices: [],
    peerConnection: null,
    signalingSocket: null,

    // 设置
    settings: {
      frameRate: 60,
      resolution: '1440p',
      quality: 'ultra',
      shareAudio: true,
      shareCursor: true
    },

    // 性能监控
    performance: {
      bitrate: 0,
      resolution: '0×0',
      framerate: 0,
      packetLoss: 0,
      rtt: 0
    },
    adaptiveBitrate: {
      enabled: false,
      currentBitrateKbps: 0,
      qualityTier: 'high'
    },

    // 聊天
    chatMessages: [],
    chatNewMessage: '',
    chatIsSending: false,

    // 状态
    status: '就绪',
    statusType: 'info',
    statusHistory: []
  }),

  actions: {
    // ── 状态 ────────────────────────────────────────────────────────────
    updateStatus(message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info') {
      const timestamp = new Date().toLocaleTimeString()
      this.status = message
      this.statusType = type
      this.statusHistory.push({ timestamp, message, type })
      if (this.statusHistory.length > MAX_STATUS_HISTORY) {
        this.statusHistory.shift()
      }
    },

    clearStatus() {
      this.status = '就绪'
      this.statusType = 'info'
      this.statusHistory = []
    },

    // ── 连接 ────────────────────────────────────────────────────────────
    setRoom(roomId: string) { this.roomId = roomId },
    setClientId(clientId: string) { this.clientId = clientId },
    setConnected(connected: boolean) { this.isConnected = connected },
    setStreaming(streaming: boolean) { this.isStreaming = streaming },
    incrementReconnectAttempts() { this.signalingReconnectAttempts++ },
    incrementIceRestartAttempts() { this.iceRestartAttempts++ },
    resetReconnectAttempts() { this.signalingReconnectAttempts = 0 },
    resetIceRestartAttempts() { this.iceRestartAttempts = 0 },

    // ── 媒体流 ──────────────────────────────────────────────────────────
    setLocalStream(stream: MediaStream | null) {
      if (this.localStream) {
        this.localStream.getTracks().forEach(t => t.stop())
      }
      this.localStream = stream
    },

    setRemoteStream(stream: MediaStream | null) {
      if (this.remoteStream) {
        this.remoteStream.getTracks().forEach(t => t.stop())
      }
      this.remoteStream = stream
    },

    setScreenStream(stream: MediaStream | null) {
      if (this.screenStream) {
        this.screenStream.getTracks().forEach(t => t.stop())
      }
      this.screenStream = stream
    },

    setAudioStream(stream: MediaStream | null) {
      if (this.audioStream) {
        this.audioStream.getTracks().forEach(t => t.stop())
      }
      this.audioStream = stream
    },

    setAudioDevices(devices: AudioDevice[]) { this.audioDevices = devices },
    setSelectedAudioDevice(deviceId: string | null) { this.selectedAudioDeviceId = deviceId },

    setPeerConnection(pc: RTCPeerConnection | null) {
      // 只赋值；close 由调用方在赋值前负责，避免重复 close
      this.peerConnection = pc
    },

    setSignalingSocket(socket: WebSocket | null) {
      if (this.signalingSocket) {
        this.signalingSocket.close()
      }
      this.signalingSocket = socket
    },

    // ── 设置 ────────────────────────────────────────────────────────────
    updateSettings(newSettings: Partial<WebRTCSettings>) {
      this.settings = { ...this.settings, ...newSettings }
    },

    // ── 性能 ────────────────────────────────────────────────────────────
    updatePerformance(data: Partial<PerformanceData>) {
      this.performance = { ...this.performance, ...data }
    },

    updateAdaptiveBitrate(data: Partial<AdaptiveBitrateState>) {
      this.adaptiveBitrate = { ...this.adaptiveBitrate, ...data }
    },

    // ── 聊天 ────────────────────────────────────────────────────────────
    addChatMessage(message: LocalChatMessage) {
      this.chatMessages.push(message)
      if (this.chatMessages.length > MAX_CHAT_MESSAGES) {
        this.chatMessages = this.chatMessages.slice(-MAX_CHAT_MESSAGES)
      }
    },

    removeChatMessage(id: string) {
      this.chatMessages = this.chatMessages.filter(m => m.id !== id)
    },

    clearChatMessages() {
      this.chatMessages = []
      this.chatNewMessage = ''
      this.chatIsSending = false
    },

    setChatNewMessage(text: string) { this.chatNewMessage = text },
    setChatIsSending(sending: boolean) { this.chatIsSending = sending },

    // ── 清理 ────────────────────────────────────────────────────────────
    cleanup() {
      if (this.peerConnection) {
        this.peerConnection.close()
        this.peerConnection = null
      }
      if (this.signalingSocket) {
        this.signalingSocket.close()
        this.signalingSocket = null
      }
      if (this.localStream) {
        this.localStream.getTracks().forEach(t => t.stop())
        this.localStream = null
      }
      if (this.remoteStream) {
        this.remoteStream.getTracks().forEach(t => t.stop())
        this.remoteStream = null
      }
      if (this.screenStream) {
        this.screenStream.getTracks().forEach(t => t.stop())
        this.screenStream = null
      }
      if (this.audioStream) {
        this.audioStream.getTracks().forEach(t => t.stop())
        this.audioStream = null
      }
      this.isConnected = false
      this.isStreaming = false
      this.roomId = ''
      this.clientId = ''
      this.resetReconnectAttempts()
      this.resetIceRestartAttempts()
      this.performance = { bitrate: 0, resolution: '0×0', framerate: 0, packetLoss: 0, rtt: 0 }
      this.adaptiveBitrate = { enabled: false, currentBitrateKbps: 0, qualityTier: 'high' }
      this.clearChatMessages()
      this.updateStatus('已清理所有资源', 'info')
    }
  },

  getters: {
    currentStatus: (state): StatusHistoryItem => ({
      message: state.status,
      type: state.statusType,
      timestamp: new Date().toLocaleTimeString()
    }),

    statusLog: (state): StatusHistoryItem[] => state.statusHistory,

    connectionInfo: (state) => ({
      isConnected: state.isConnected,
      isStreaming: state.isStreaming,
      roomId: state.roomId,
      clientId: state.clientId
    }),

    performanceInfo: (state): PerformanceData => state.performance,
    currentSettings: (state): WebRTCSettings => state.settings,
    availableAudioDevices: (state): AudioDevice[] => state.audioDevices,

    selectedAudioDevice: (state): AudioDevice | undefined =>
      state.audioDevices.find(d => d.deviceId === state.selectedAudioDeviceId)
  }
})
