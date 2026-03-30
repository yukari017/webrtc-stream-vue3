/**
 * WebSocket 消息类型定义
 */

import { WebSocket } from 'ws'

// WebRTC 类型定义（服务端）
export interface RTCSessionDescriptionInit {
  type: 'offer' | 'answer' | 'pranswer' | 'rollback'
  sdp: string
}

export interface RTCIceCandidateInit {
  candidate?: string
  sdpMid?: string | null
  sdpMLineIndex?: number | null
  usernameFragment?: string
}

// 基础消息结构
export interface BaseMessage {
  type: string
  from?: string
}

// 欢迎消息
export interface WelcomeMessage extends BaseMessage {
  type: 'welcome'
  yourId: string
  roomId: string
}

// 房间就绪消息
export interface RoomReadyMessage extends BaseMessage {
  type: 'room-ready'
}

// 房间已满消息
export interface RoomFullMessage extends BaseMessage {
  type: 'room-full'
  roomId: string
}

// 对端断开消息
export interface PeerDisconnectedMessage extends BaseMessage {
  type: 'peer-disconnected'
}

// 心跳消息
export interface PingMessage extends BaseMessage {
  type: 'ping'
  ts?: number
}

export interface PongMessage extends BaseMessage {
  type: 'pong'
  ts: number
}

// WebRTC 信令消息
export interface OfferMessage extends BaseMessage {
  type: 'offer'
  sdp: RTCSessionDescriptionInit
}

export interface AnswerMessage extends BaseMessage {
  type: 'answer'
  sdp: RTCSessionDescriptionInit
}

export interface CandidateMessage extends BaseMessage {
  type: 'candidate'
  candidate: RTCIceCandidateInit
}

// 聊天消息
export interface ChatMessage extends BaseMessage {
  type: 'chat-message'
  text: string
  sender?: string
  timestamp?: number
}

// 联合类型
export type SignalingMessage =
  | WelcomeMessage
  | RoomReadyMessage
  | RoomFullMessage
  | PeerDisconnectedMessage
  | PingMessage
  | PongMessage
  | OfferMessage
  | AnswerMessage
  | CandidateMessage
  | ChatMessage

// 扩展的 WebSocket 接口
export interface ExtWebSocket extends WebSocket {
  id: string
  roomId: string
  isAlive: boolean
  lastSeen: number
}

// 房间信息
export interface RoomInfo {
  id: string
  clients: Set<ExtWebSocket>
  createdAt: number
  lastActivity: number
}

// 服务器配置
export interface ServerConfig {
  port: number
  host: string
  ssl: {
    keyPath: string
    certPath: string
  }
  heartbeat: {
    interval: number
    timeout: number
  }
  room: {
    maxClients: number
    idleTimeout: number
  }
  rateLimit?: {
    enabled: boolean
    maxMessages: number
    windowMs: number
  }
}

// 服务器统计
export interface ServerStats {
  totalConnections: number   // 历史累计连接数
  activeConnections: number  // 当前活跃连接数
  activeRooms: number
  activeClients: number
  uptime: number
}
