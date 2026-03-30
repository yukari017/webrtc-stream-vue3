/**
 * 房间管理器
 */

import { WebSocket } from 'ws'
import { logger } from '../utils/logger'
import type { RoomInfo, ServerConfig, ExtWebSocket } from '../types'

export type { ExtWebSocket }

export class RoomManager {
  private rooms: Map<string, RoomInfo> = new Map()
  private config: ServerConfig
  private cleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor(config: ServerConfig) {
    this.config = config
  }

  /**
   * 启动定时清理任务
   */
  startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleRooms()
    }, 60000) // 每分钟检查一次
    
    logger.info('房间清理任务已启动')
  }

  /**
   * 停止定时清理任务
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  /**
   * 客户端加入房间
   * 角色说明（支持未来扩展）：
   *   - broadcaster：推流端（固定 1 人，创建房间时自动为此角色）
   *   - viewer：观看端（最多 maxClients-1 人）
   */
  joinRoom(ws: ExtWebSocket, roomId: string): { success: boolean; reason?: string } {
    let room = this.rooms.get(roomId)

    if (!room) {
      room = {
        id: roomId,
        clients: new Set(),
        createdAt: Date.now(),
        lastActivity: Date.now()
      }
      this.rooms.set(roomId, room)
      logger.info(`创建新房间: ${roomId}`)
    }

    // 容量保护：maxClients 包含推流端（broadcaster 1 + viewer N）
    if (room.clients.size >= this.config.room.maxClients) {
      logger.warn(`房间 ${roomId} 已满，拒绝客户端 ${ws.id}`)
      return { success: false, reason: 'room-full' }
    }

    room.clients.add(ws)
    room.lastActivity = Date.now()
    ws.roomId = roomId

    logger.info(`客户端 ${ws.id} 加入房间 ${roomId}，当前人数: ${room.clients.size}`)

    return { success: true }
  }

  /**
   * 客户端离开房间
   */
  leaveRoom(ws: ExtWebSocket): void {
    const roomId = ws.roomId
    if (!roomId) return
    
    const room = this.rooms.get(roomId)
    if (!room) return
    
    room.clients.delete(ws)
    logger.info(`客户端 ${ws.id} 离开房间 ${roomId}，剩余人数: ${room.clients.size}`)
    
    if (room.clients.size === 0) {
      this.rooms.delete(roomId)
      logger.info(`房间 ${roomId} 已清空并删除`)
    }
  }

  /**
   * 更新房间活动时间戳
   * 在消息交互时调用，防止活跃房间被误判为空闲
   */
  updateActivity(roomId: string): void {
    const room = this.rooms.get(roomId)
    if (room) {
      room.lastActivity = Date.now()
    }
  }

  /**
   * 广播消息到房间（排除 sender）
   */
  broadcast(roomId: string, message: unknown, sender?: ExtWebSocket): void {
    const room = this.rooms.get(roomId)
    if (!room) return

    room.lastActivity = Date.now() // 消息交互算活动
    const data = JSON.stringify(message)

    room.clients.forEach(client => {
      if (client !== sender && client.readyState === WebSocket.OPEN) {
        client.send(data)
      }
    })
  }

  /**
   * 单点路由：只发给指定对端
   * 找不到目标时不抛错，静默忽略（对端可能已离开）
   */
  sendTo(roomId: string, targetPeerId: string, message: unknown, sender?: ExtWebSocket): void {
    const room = this.rooms.get(roomId)
    if (!room) return

    room.lastActivity = Date.now() // 消息交互算活动
    const data = JSON.stringify(message)

    for (const client of room.clients) {
      if (client !== sender && (client as ExtWebSocket).id === targetPeerId) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(data)
        }
        return // 找到就发，发完即止
      }
    }
  }

  /**
   * 检查房间是否就绪
   * 就绪条件：至少 1 个推流端 + 1 个观看端（总共 ≥ 2 人）
   * 未来可扩展为：isBroadcasterReady / isViewerCount 等更细粒度判断
   */
  isRoomReady(roomId: string): boolean {
    const room = this.rooms.get(roomId)
    return room !== undefined && room.clients.size >= 2
  }

  /**
   * 清理空闲房间
   */
  private cleanupIdleRooms(): void {
    const now = Date.now()
    const idleTimeout = this.config.room.idleTimeout
    
    this.rooms.forEach((room, roomId) => {
      if (now - room.lastActivity > idleTimeout) {
        logger.warn(`清理空闲房间: ${roomId}`)
        
        // 通知房间内的客户端
        room.clients.forEach(client => {
          const extClient: ExtWebSocket = client
          if (extClient.readyState === WebSocket.OPEN) {
            extClient.send(JSON.stringify({ type: 'room-timeout' }))
            extClient.close()
          }
        })
        
        this.rooms.delete(roomId)
      }
    })
  }

  /**
   * 获取统计信息
   */
  getStats(): { rooms: number; clients: number } {
    let totalClients = 0
    this.rooms.forEach(room => {
      totalClients += room.clients.size
    })
    
    return {
      rooms: this.rooms.size,
      clients: totalClients
    }
  }
}
