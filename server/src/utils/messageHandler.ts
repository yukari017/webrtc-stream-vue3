/**
 * 消息处理器
 */

import { logger } from '../utils/logger'
import type { RoomManager } from '../utils/roomManager'
import type {
  BaseMessage,
  ExtWebSocket,
  PingMessage,
  ChatMessage
} from '../types'

export class MessageHandler {
  private roomManager: RoomManager

  constructor(roomManager: RoomManager) {
    this.roomManager = roomManager
  }

  // ─── 消息入口 ─────────────────────────────────────────────────────────────

  /**
   * 处理接收到的消息
   * 遵循：先类型守卫 → 再路由分发 → 最后广播
   */
  handle(ws: ExtWebSocket, rawMessage: string): void {
    // 1. JSON 解析
    let parsed: unknown
    try {
      parsed = JSON.parse(rawMessage)
    } catch {
      logger.warn(`无法解析 JSON，跳过: ${rawMessage.substring(0, 80)}`)
      return
    }

    // 2. 基础类型守卫
    if (!this.isBaseMessage(parsed)) {
      logger.warn(`缺少 type 字段，跳过`)
      return
    }

    // 3. 路由分发（由 type 触发 discriminated union 联合类型收窄）
    switch (parsed.type) {
      case 'ping':
        this.handlePing(ws, parsed as PingMessage)
        break

      case 'offer':
      case 'answer':
      case 'candidate':
        this.handleSignaling(ws, parsed)
        break

      case 'chat-message':
        this.handleChat(ws, parsed as ChatMessage)
        break

      default:
        logger.warn(`未知消息类型: ${parsed.type}，忽略`)
    }
  }

  // ─── 心跳 ────────────────────────────────────────────────────────────────

  private handlePing(ws: ExtWebSocket, _message: PingMessage): void {
    ws.lastSeen = Date.now()
    ws.isAlive = true

    try {
      ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }))
    } catch (error) {
      logger.warn('发送 pong 失败:', error)
    }
  }

  // ─── 信令（offer / answer / candidate） ──────────────────────────────────

  /**
   * 处理 WebRTC 信令消息
   * - 附加 from 字段
   * - 支持 targetPeerId 单点路由（无此字段时向全房间广播）
   */
  private handleSignaling(ws: ExtWebSocket, message: BaseMessage): void {
    const enriched = { ...message, from: ws.id } as Record<string, unknown>
    const targetPeerId = enriched['to'] as string | undefined

    if (targetPeerId) {
      // 单点路由：只发给指定对端（防止广播滥用）
      this.roomManager.sendTo(ws.roomId, targetPeerId, enriched, ws)
      logger.debug(`[信令] ${message.type} → 指定对端 ${targetPeerId}`)
    } else {
      // 广播给房间内除发送者外的所有客户端
      this.roomManager.broadcast(ws.roomId, enriched, ws)
      logger.debug(`[信令] ${message.type} → 广播`)
    }
  }

  // ─── 聊天 ────────────────────────────────────────────────────────────────

  private handleChat(ws: ExtWebSocket, message: ChatMessage): void {
    // 长度限制
    const text = (message.text ?? '').trim().substring(0, 500)
    const enriched = {
      ...message,
      text,
      from: ws.id,
      timestamp: Date.now()
    }

    this.roomManager.broadcast(ws.roomId, enriched, ws)
    logger.debug(`[聊天] 转发 (${text.length} chars)`)
  }

  // ─── 工具 ────────────────────────────────────────────────────────────────

  /** 最基础的结构守卫：必须有 type 字段且为 string */
  private isBaseMessage(v: unknown): v is BaseMessage {
    return (
      v !== null &&
      typeof v === 'object' &&
      'type' in v &&
      typeof (v as Record<string, unknown>)['type'] === 'string'
    )
  }
}
