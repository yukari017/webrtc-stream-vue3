/**
 * RateLimiter 单元测试
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { RateLimiter } from './rateLimiter'

// 加速时间：使用极小窗口
const FAST_CONFIG = { windowMs: 100, maxMessages: 5 }

describe('RateLimiter', () => {
  let limiter: RateLimiter

  beforeEach(() => {
    limiter = new RateLimiter(FAST_CONFIG)
  })

  // ─── check() ────────────────────────────────────────────────────────

  describe('check()', () => {
    it('窗口内未超限 → 放行', () => {
      const clientId = 'client-1'
      for (let i = 0; i < 5; i++) {
        expect(limiter.check(clientId)).toBe(true)
      }
    })

    it('窗口内达到上限 → 拦截', () => {
      const clientId = 'client-2'
      for (let i = 0; i < 5; i++) limiter.check(clientId)
      expect(limiter.check(clientId)).toBe(false)
    })

    it('不同客户端独立计数', () => {
      limiter.check('a'); limiter.check('a')
      limiter.check('a'); limiter.check('a')
      limiter.check('a') // a 达到上限

      expect(limiter.check('a')).toBe(false)
      expect(limiter.check('b')).toBe(true) // b 未超限
    })

    it('窗口到期后重置计数', async () => {
      const clientId = 'client-3'
      for (let i = 0; i < 5; i++) limiter.check(clientId)
      expect(limiter.check(clientId)).toBe(false)

      // 等待窗口过期
      await new Promise(r => setTimeout(r, 150))
      expect(limiter.check(clientId)).toBe(true) // 新窗口，从 0 开始
    })
  })

  // ─── remove() ────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('移除后 getCount 返回 0', () => {
      const id = 'client-4'
      limiter.check(id); limiter.check(id)
      expect(limiter.getCount(id)).toBe(2)

      limiter.remove(id)
      expect(limiter.getCount(id)).toBe(0)
    })

    it('移除后 check 重新计数', () => {
      const id = 'client-5'
      for (let i = 0; i < 5; i++) limiter.check(id) // 耗尽
      expect(limiter.check(id)).toBe(false)

      limiter.remove(id)
      expect(limiter.check(id)).toBe(true) // 重置
    })
  })

  // ─── reset() ────────────────────────────────────────────────────────

  describe('reset()', () => {
    it('清空所有客户端记录', () => {
      limiter.check('a'); limiter.check('b')
      expect(limiter.getCount('a')).toBe(1)
      expect(limiter.getCount('b')).toBe(1)

      limiter.reset()
      expect(limiter.getCount('a')).toBe(0)
      expect(limiter.getCount('b')).toBe(0)
    })
  })

  // ─── getCount() ─────────────────────────────────────────────────────

  describe('getCount()', () => {
    it('未记录返回 0', () => {
      expect(limiter.getCount('unknown')).toBe(0)
    })

    it('返回当前窗口内的消息数', () => {
      const id = 'client-6'
      limiter.check(id)
      limiter.check(id)
      expect(limiter.getCount(id)).toBe(2)
    })
  })

  // ─── 边界条件 ────────────────────────────────────────────────────────

  describe('边界条件', () => {
    it('maxMessages = 1', () => {
      const strict = new RateLimiter({ windowMs: 1000, maxMessages: 1 })
      expect(strict.check('id')).toBe(true)
      expect(strict.check('id')).toBe(false)
    })

    it('maxMessages = 0（完全限流）', () => {
      const zero = new RateLimiter({ windowMs: 1000, maxMessages: 0 })
      expect(zero.check('id')).toBe(false)
    })

    it('多次 remove 无副作用', () => {
      const id = 'client-7'
      limiter.remove(id) // 从未存在
      limiter.remove(id) // 再次删除
      expect(limiter.getCount(id)).toBe(0)
      expect(limiter.check(id)).toBe(true) // 正常工作
    })
  })
})
