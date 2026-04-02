/**
 * 速率限制器
 * 基于滑动窗口算法，限制每个客户端在时间窗口内的消息数量
 */

import { logger } from './logger'

export interface RateLimiterConfig {
  /** 时间窗口（毫秒） */
  windowMs: number
  /** 窗口内最多消息数 */
  maxMessages: number
}

interface ClientRecord {
  count: number
  resetAt: number
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  windowMs: 10_000,   // 10 秒
  maxMessages: 30     // 最多 30 条
}

export class RateLimiter {
  private clients = new Map<string, ClientRecord>()
  private readonly config: RateLimiterConfig
  private readonly label: string

  constructor(config: Partial<RateLimiterConfig> = {}, label = 'rate-limit') {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.label = label
  }

  /**
   * 检查是否允许通过
   * @returns true = 允许，false = 被限流
   */
  check(clientId: string): boolean {
    const now = Date.now()
    const record = this.clients.get(clientId)

    if (!record || now > record.resetAt) {
      // 新窗口开始前先检查限制（防止 maxMessages=0 时错误放行）
      if (this.config.maxMessages <= 0) {
        logger.warn(`[${this.label}] 客户端 ${clientId} 触发限流 (maxMessages=0)`)
        return false
      }
      this.clients.set(clientId, { count: 1, resetAt: now + this.config.windowMs })
      return true
    }

    if (record.count >= this.config.maxMessages) {
      logger.warn(`[${this.label}] 客户端 ${clientId} 触发限流 (${record.count}/${this.config.maxMessages})`)
      return false
    }

    record.count++
    return true
  }

  /** 移除客户端记录（客户端断开时调用） */
  remove(clientId: string): void {
    this.clients.delete(clientId)
  }

  /** 清空所有记录 */
  reset(): void {
    this.clients.clear()
  }

  /** 获取当前窗口内的消息数 */
  getCount(clientId: string): number {
    const record = this.clients.get(clientId)
    if (!record || Date.now() > record.resetAt) return 0
    return record.count
  }
}
