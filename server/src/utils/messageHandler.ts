/**
 * 消息处理器
 */

import { WebSocket } from 'ws'
import { logger } from '../utils/logger'
import type { RoomManager } from '../utils/roomManager'
import type { BaseMessage } from '../types'

// 扩展的 WebSocket 接口
interface ExtWebSocket extends WebSocket {
  id: string
  roomId: string
  isAlive: boolean
  lastSeen: number
}

export class MessageHandler {
  private roomManager: RoomManager

  constructor(roomManager: RoomManager) {
    this.roomManager = roomManager
  }

  /**
   * 处理接收到的消息
   */
  handle(ws: ExtWebSocket, rawMessage: string): void {
    try {
      const data = JSON.parse(rawMessage) as BaseMessage
      
      // 附加发送者 ID
      const message = { ...data, from: ws.id }
      
      switch (message.type) {
        case 'ping':
          this.handlePing(ws)
          break
        
        case 'offer':
        case 'answer':
        case 'candidate':
          this.handleSignaling(ws, message)
          break
        
        case 'chat-message':
          this.handleChat(ws, message)
          break
        
        default:
          logger.warn(`未知消息类型: ${(message as BaseMessage).type}`)
      }
    } catch (error) {
      logger.error('消息解析错误:', error)
    }
  }

  /**
   * 处理心跳消息
   */
  private handlePing(ws: ExtWebSocket): void {
    ws.lastSeen = Date.now()
    ws.isAlive = true
    
    try {
      ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }))
    } catch (error) {
      logger.warn('发送 pong 失败:', error)
    }
  }

  /**
   * 处理 WebRTC 信令消息
   */
  private handleSignaling(ws: ExtWebSocket, message: Record<string, unknown>): void {
    this.roomManager.broadcast(ws.roomId, message, ws)
    logger.debug(`转发 ${message.type} 消息`)
  }

  /**
   * 处理聊天消息
   */
  private handleChat(ws: ExtWebSocket, message: Record<string, unknown>): void {
    // 消息长度限制
    if (typeof message.text === 'string') {
      message.text = (message.text as string).trim().substring(0, 500)
    }
    
    this.roomManager.broadcast(ws.roomId, message, ws)
    logger.debug(`转发聊天消息`)
  }
}
