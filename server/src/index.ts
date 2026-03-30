/**
 * WebRTC 信令服务器
 * TypeScript 重构版本
 */

import { createServer as createHttpsServer } from 'https'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { WebSocketServer, WebSocket, RawData } from 'ws'
import express, { Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'

import { loadConfig } from './utils/config'
import { logger } from './utils/logger'
import { RoomManager } from './utils/roomManager'
import { MessageHandler } from './utils/messageHandler'
import type { ServerStats, ExtWebSocket } from './types'

// 加载配置
const config = loadConfig()
logger.info('配置加载完成')

// 创建 Express 应用
const app = express()

// 静态文件服务
const publicDir = resolve(__dirname, '../public-dist')
app.use(express.static(publicDir))

// SPA 路由
const spaRoutes = ['/', '/viewer']
spaRoutes.forEach(route => {
  app.get(route, (_req: Request, res: Response) => {
    res.sendFile(resolve(publicDir, 'index.html'))
  })
})

// 初始化房间管理器
const roomManager = new RoomManager(config)
roomManager.startCleanup()

// 初始化消息处理器
const messageHandler = new MessageHandler(roomManager)

// 统计变量
let totalConnectionsEver = 0   // 历史累计连接数（只增不减）
let activeConnections = 0      // 当前活跃连接数

// 健康检查端点
app.get('/health', (_req: Request, res: Response) => {
  const stats = roomManager.getStats()
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    totalConnectionsEver,
    activeConnections,
    ...stats
  })
})

// 统计端点
app.get('/stats', (_req: Request, res: Response) => {
  const { rooms, clients } = roomManager.getStats()
  const stats: ServerStats = {
    totalConnections: totalConnectionsEver,
    activeConnections,
    activeRooms: rooms,
    activeClients: clients,
    uptime: process.uptime()
  }
  res.json(stats)
})

// 读取 SSL 证书
const sslOptions = {
  key: readFileSync(resolve(config.ssl.keyPath)),
  cert: readFileSync(resolve(config.ssl.certPath))
}

// 创建 HTTPS 服务器
const server = createHttpsServer(sslOptions, app)

// 创建 WebSocket 服务器
const wss = new WebSocketServer({ server })

// 心跳检测
setInterval(() => {
  wss.clients.forEach((ws) => {
    const extWs = ws as ExtWebSocket
    
    if (extWs.isAlive === false) {
      logger.warn(`检测到僵尸连接，终止之，房间: ${extWs.roomId}`)
      return ws.terminate()
    }
    
    extWs.isAlive = false
    ws.ping()
  })
}, config.heartbeat.interval)

// WebSocket 连接处理
wss.on('connection', (ws: WebSocket, req) => {
  // 解析房间 ID
  const url = new URL(req.url || '', `wss://${req.headers.host}`)
  const roomId = url.searchParams.get('room') || 'default'
  const clientId = uuidv4()
  
  // 扩展 WebSocket 对象
  const extWs = ws as ExtWebSocket
  extWs.id = clientId
  extWs.roomId = roomId
  extWs.isAlive = true
  extWs.lastSeen = Date.now()
  
  extWs.on('pong', () => {
    extWs.isAlive = true
    extWs.lastSeen = Date.now()
  })
  
  logger.info(`新客户端连接: ${clientId}, 尝试加入房间: ${roomId}`)
  totalConnectionsEver++
  activeConnections++
  
  // 尝试加入房间
  const result = roomManager.joinRoom(extWs, roomId)
  
  if (!result.success) {
    extWs.send(JSON.stringify({ type: 'room-full', roomId }))
    extWs.close(4001, 'room full')
    return
  }
  
  // 发送欢迎消息
  extWs.send(JSON.stringify({
    type: 'welcome',
    yourId: clientId,
    roomId
  }))
  
  // 检查房间是否就绪
  if (roomManager.isRoomReady(roomId)) {
    roomManager.broadcast(roomId, { type: 'room-ready' })
  }
  
  // 消息处理
  extWs.on('message', (data: RawData) => {
    const rawMessage = typeof data === 'string' ? data : data.toString()
    roomManager.updateActivity(roomId) // 收到消息即刷新活动时间
    messageHandler.handle(extWs, rawMessage)
  })
  
  // 关闭处理
  extWs.on('close', (code: number, reason: Buffer) => {
    logger.info(`客户端断开: ${clientId}, 房间: ${roomId}, code=${code}, reason=${reason.toString()}`)

    // 先广播（此时房间仍存在），再离开（可能触发房间删除）
    // 顺序不能颠倒：leaveRoom 在最后一人离开时会删除房间，broadcast 会静默失败
    roomManager.broadcast(roomId, { type: 'peer-disconnected' })

    roomManager.leaveRoom(extWs)
    activeConnections--
  })
  
  // 错误处理
  extWs.on('error', (error: Error) => {
    logger.error(`WebSocket 错误 [${clientId}]:`, error.message)
  })
})

// 启动服务器
server.listen(config.port, config.host, () => {
  logger.info(`✅ 安全信令服务器运行在 https://${config.host}:${config.port}`)
})

// 优雅关闭
const gracefulShutdown = () => {
  logger.info('收到关闭信号，开始优雅关闭...')
  
  roomManager.stopCleanup()
  
  wss.clients.forEach(ws => {
    ws.close(1001, 'server shutdown')
  })
  
  server.close(() => {
    logger.info('服务器已关闭')
    process.exit(0)
  })
}

process.on('SIGTERM', gracefulShutdown)
process.on('SIGINT', gracefulShutdown)
