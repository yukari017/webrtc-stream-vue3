/**
 * eventBus 单元测试
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { eventBus } from './eventBus'

beforeEach(() => {
  eventBus.reset()
})

// ─── on / off ──────────────────────────────────────────────────────────────

describe('订阅与取消订阅', () => {
  it('on() 后 emit() 能收到回调', () => {
    const received: unknown[] = []
    eventBus.on('test', (...args) => received.push(...args))

    eventBus.emit('test', 'a', 1)
    expect(received).toEqual(['a', 1])

    eventBus.emit('test', 'b', 2)
    expect(received).toEqual(['a', 1, 'b', 2])
  })

  it('off() 能移除已订阅的回调', () => {
    const received: string[] = []
    const cb1 = (v: unknown) => received.push(`cb1:${v}`)
    const cb2 = (v: unknown) => received.push(`cb2:${v}`)

    eventBus.on('x', cb1)
    eventBus.on('x', cb2)
    eventBus.emit('x', 'hello')
    expect(received).toEqual(['cb1:hello', 'cb2:hello'])

    eventBus.off('x', cb1)
    eventBus.emit('x', 'world')
    expect(received).toEqual(['cb1:hello', 'cb2:hello', 'cb2:world'])
  })

  it('同一回调重复 on() 不会触发两次（Set 去重）', () => {
    const called = { count: 0 }
    const cb = () => called.count++

    eventBus.on('dup', cb)
    eventBus.on('dup', cb) // 重复订阅

    eventBus.emit('dup')
    expect(called.count).toBe(1)
  })
})

// ─── 错误隔离 ─────────────────────────────────────────────────────────────

describe('emit() 错误隔离', () => {
  it('单个回调抛错不影响其他回调和 emit() 本身', () => {
    const ok: string[] = []

    eventBus.on('error-test', () => { throw new Error('boom') })
    eventBus.on('error-test', () => ok.push('still runs'))

    // 不应抛错
    expect(() => eventBus.emit('error-test')).not.toThrow()
    expect(ok).toEqual(['still runs'])
  })
})

// ─── reset / size ────────────────────────────────────────────────────────

describe('重置与调试', () => {
  it('reset() 清空所有订阅', () => {
    eventBus.on('e1', () => {})
    eventBus.on('e2', () => {})
    expect(eventBus.size).toBe(2)

    eventBus.reset()
    expect(eventBus.size).toBe(0)
  })

  it('off() 使事件引用计数降为 0 时自动删除该事件', () => {
    eventBus.on('auto-clean', () => {})
    expect(eventBus.size).toBe(1)

    const cb = () => {}
    eventBus.on('to-remove', cb)
    eventBus.off('to-remove', cb)
    expect(eventBus.size).toBe(1) // 'to-remove' 已删除
  })
})
