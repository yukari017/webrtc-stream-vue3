/**
 * eventBus 单元测试
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { eventBus } from './eventBus'

beforeEach(() => {
  eventBus.reset()
})

// ─── on / off (不安全版本) ───────────────────────────────────────────────

describe('订阅与取消订阅', () => {
  it('onUnsafe() 后 emitUnsafe() 能收到回调', () => {
    const received: unknown[] = []
    eventBus.onUnsafe('test', (...args) => received.push(...args))

    eventBus.emitUnsafe('test', 'a', 1)
    expect(received).toEqual(['a', 1])

    eventBus.emitUnsafe('test', 'b', 2)
    expect(received).toEqual(['a', 1, 'b', 2])
  })

  it('offUnsafe() 能移除已订阅的回调', () => {
    const received: string[] = []
    const cb1 = (v: unknown) => received.push(`cb1:${v}`)
    const cb2 = (v: unknown) => received.push(`cb2:${v}`)

    eventBus.onUnsafe('x', cb1)
    eventBus.onUnsafe('x', cb2)
    eventBus.emitUnsafe('x', 'hello')
    expect(received).toEqual(['cb1:hello', 'cb2:hello'])

    eventBus.offUnsafe('x', cb1)
    eventBus.emitUnsafe('x', 'world')
    expect(received).toEqual(['cb1:hello', 'cb2:hello', 'cb2:world'])
  })

  it('同一回调重复 onUnsafe() 不会触发两次（Set 去重）', () => {
    const called = { count: 0 }
    const cb = () => called.count++

    eventBus.onUnsafe('dup', cb)
    eventBus.onUnsafe('dup', cb) // 重复订阅

    eventBus.emitUnsafe('dup')
    expect(called.count).toBe(1)
  })
})

// ─── 错误隔离 ─────────────────────────────────────────────────────────────

describe('emitUnsafe() 错误隔离', () => {
  it('单个回调抛错不影响其他回调和 emitUnsafe() 本身', () => {
    const ok: string[] = []

    eventBus.onUnsafe('error-test', () => { throw new Error('boom') })
    eventBus.onUnsafe('error-test', () => ok.push('still runs'))

    // 不应抛错
    expect(() => eventBus.emitUnsafe('error-test')).not.toThrow()
    expect(ok).toEqual(['still runs'])
  })
})

// ─── reset / size ────────────────────────────────────────────────────────

describe('重置与调试', () => {
  it('reset() 清空所有订阅', () => {
    eventBus.onUnsafe('e1', () => {})
    eventBus.onUnsafe('e2', () => {})
    expect(eventBus.size).toBe(2)

    eventBus.reset()
    expect(eventBus.size).toBe(0)
  })

  it('offUnsafe() 使事件引用计数降为 0 时自动删除该事件', () => {
    eventBus.onUnsafe('auto-clean', () => {})
    expect(eventBus.size).toBe(1)

    const cb = () => {}
    eventBus.onUnsafe('to-remove', cb)
    eventBus.offUnsafe('to-remove', cb)
    expect(eventBus.size).toBe(1) // 'to-remove' 已删除
  })
})

// ─── 类型安全版本测试 ───────────────────────────────────────────────────

describe('类型安全版本', () => {
  it('emit() 需要两个参数（类型安全事件）', () => {
    const received: unknown[] = []
    eventBus.on('signaling-connected', (data) => received.push(data))
    eventBus.on('connection-closed', (data) => received.push(data))

    // 类型安全：必须传 data 参数
    eventBus.emit('signaling-connected', undefined)
    eventBus.emit('connection-closed', undefined)
    expect(received).toEqual([undefined, undefined])
  })
})