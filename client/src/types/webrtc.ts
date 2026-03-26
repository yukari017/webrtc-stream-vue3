// WebRTC 相关类型定义

export interface WebRTCSettings {
  frameRate: number
  resolution: string
  quality: string
  shareAudio: boolean
  shareCursor: boolean
}

export interface PerformanceData {
  bitrate: number
  resolution: string
  framerate: number
  packetLoss: number
  rtt: number
}

export interface StatusHistoryItem {
  timestamp: string
  message: string
  type: 'info' | 'warning' | 'error' | 'success'
}

export interface AudioDevice {
  deviceId: string
  label: string
  kind: MediaDeviceKind
}

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'candidate' | 'join' | 'leave' | 'room-ready' | 'peer-disconnected'
  sdp?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
  roomId?: string
  clientId?: string
}

export interface ChatMessage {
  type: 'chat'
  text: string
  sender: string
  timestamp: number
}

// 扩展 RTCPeerConnection 添加 dataChannel 属性
declare global {
  interface RTCPeerConnection {
    dataChannel?: RTCDataChannel
  }
}
