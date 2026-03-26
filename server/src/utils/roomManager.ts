/**
 * 房间管理器
 */

import { WebSocket } from 'ws'
import { logger } from '../utils/logger'
import type { RoomInfo, ServerConfig } from '../types'

// 扩展的 WebSocket 接口
interface ExtWebSocket extends WebSocket {
  id: string
  roomId: string
  isAlive: boolean
  lastSeen: number
}

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
    
    // 检查房间是否已满
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
   * 广播消息到房间
   */
  broadcast(roomId: string, message: unknown, sender?: ExtWebSocket): void {
    const room = this.rooms.get(roomId)
    if (!room) return
    
    const data = JSON.stringify(message)
    
    room.clients.forEach(client => {
      if (client !== sender && client.readyState === client.OPEN) {
        client.send(data)
      }
    })
  }

  /**
   * 检查房间是否就绪（2人）
   */
  isRoomReady(roomId: string): boolean {
    const room = this.rooms.get(roomId)
    return room !== undefined && room.clients.size >= this.config.room.maxClients
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
          const extClient = client as ExtWebSocket
          if (extClient.readyState === extClient.OPEN) {
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
