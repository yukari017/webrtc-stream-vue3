/**
 * 服务器配置管理
 */

import type { ServerConfig } from '../types'
import { existsSync } from 'fs'

// 默认配置
const defaultConfig: ServerConfig = {
  port: parseInt(process.env.PORT || '3001'),
  host: process.env.HOST || '0.0.0.0',
  ssl: {
    keyPath: process.env.SSL_KEY_PATH || './key.pem',
    certPath: process.env.SSL_CERT_PATH || './cert.pem'
  },
  heartbeat: {
    interval: 30000,  // 30s
    timeout: 60000   // 60s
  },
  room: {
    maxClients: 2,
    idleTimeout: 3600000  // 1小时
  }
}

/**
 * 加载并验证配置
 */
export function loadConfig(): ServerConfig {
  const config = { ...defaultConfig }
  
  // 验证 SSL 证书文件存在
  if (!existsSync(config.ssl.keyPath)) {
    throw new Error(`SSL key 文件不存在: ${config.ssl.keyPath}`)
  }
  if (!existsSync(config.ssl.certPath)) {
    throw new Error(`SSL cert 文件不存在: ${config.ssl.certPath}`)
  }
  
  // 验证端口范围
  if (config.port < 1 || config.port > 65535) {
    throw new Error(`无效的端口号: ${config.port}`)
  }
  
  return config
}

export { defaultConfig }
export type { ServerConfig }
