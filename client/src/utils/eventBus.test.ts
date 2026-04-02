/**
 * eventBus 单元测试
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { eventBus } from './eventBus'

beforeEach(() => {
  eventBus.reset()
})

// ─── onUnsafe / offUnsafe ─────────────────────────────────────────────────

describe('onUnsafe / offUnsafe', () => {
  it('onUnsafe() + emitUnsafe() 能收到回调', () => {
    const received: unknown[] = []
    eventBus.onUnsafe('test', (...args) => received.push(...args))

    eventBus.emitUnsafe('test', 'a', 1)
    expect(received).toEqual(['a', 1])

    eventBus.emitUnsafe('test', 'b', 2)
    expect(received).toEqual(['a', 1, 'b', 2])
  })

  it('offUnsafe() 能移除指定回调', () => {
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

  it('offUnsafe() 使事件引用计数降为 0 时自动删除该事件', () => {
    eventBus.onUnsafe('auto-clean', () => {})
    expect(eventBus.size).toBe(1)

    const cb = () => {}
    eventBus.onUnsafe('to-remove', cb)
    eventBus.offUnsafe('to-remove', cb)
    expect(eventBus.size).toBe(1) // 'to-remove' 已删除，剩 auto-clean
  })
})

// ─── emitUnsafe 错误隔离 ─────────────────────────────────────────────────

describe('emitUnsafe 错误隔离', () => {
  it('单个回调抛错不影响其他回调和 emitUnsafe 本身', () => {
    const ok: string[] = []
    const cbErr = () => { throw new Error('boom') }
    const cbOk  = () => ok.push('still runs')

    eventBus.onUnsafe('err', cbErr)
    eventBus.onUnsafe('err', cbOk)
    expect(() => eventBus.emitUnsafe('err')).not.toThrow()
    expect(ok).toEqual(['still runs'])
  })
})

// ─── reset / size ────────────────────────────────────────────────────────

describe('reset / size', () => {
  it('reset() 清空所有 unsafeListeners', () => {
    eventBus.onUnsafe('e1', () => {})
    eventBus.onUnsafe('e2', () => {})
    expect(eventBus.size).toBe(2)

    eventBus.reset()
    expect(eventBus.size).toBe(0)
  })
})

// ─── on / off ────────────────────────────────────────────────────────────

describe('on / off（类型安全版本）', () => {
  it('on() + emit() 能正确传递 data', () => {
    const received: unknown[] = []
    eventBus.on('signaling-connected', (data) => received.push(data))
    eventBus.on('connection-closed',    (data) => received.push(data))

    eventBus.emit('signaling-connected', undefined)
    eventBus.emit('connection-closed',    undefined)
    expect(received).toEqual([undefined, undefined])
  })

  it('on() + emit() 传递 ChatMessage 对象', () => {
    const received: unknown[] = []
    const msg = { type: 'chat', text: 'hello', sender: 'alice', timestamp: 123456 }
    eventBus.on('data-channel-message', (m) => received.push(m))
    eventBus.emit('data-channel-message', msg)
    expect(received).toEqual([msg])
  })

  it('off() 能移除指定回调', () => {
    const received: string[] = []
    const cb1 = () => received.push('cb1')
    const cb2 = () => received.push('cb2')

    eventBus.on('signaling-connected', cb1)
    eventBus.on('signaling-connected', cb2)
    eventBus.emit('signaling-connected', undefined)
    expect(received).toEqual(['cb1', 'cb2'])

    eventBus.off('signaling-connected', cb1)
    eventBus.emit('signaling-connected', undefined)
    expect(received).toEqual(['cb1', 'cb2', 'cb2'])
  })

  it('off() 使事件引用计数降为 0 时自动删除该事件', () => {
    eventBus.on('signaling-connected', () => {})
    expect(eventBus.size).toBe(1)

    const cb = () => {}
    eventBus.on('peer-disconnected', cb)
    eventBus.off('peer-disconnected', cb)
    expect(eventBus.size).toBe(1) // 'peer-disconnected' 已删除，剩 signaling-connected
  })

  it('on() 单个回调抛错不影响其他回调和 emit 本身（错误隔离）', () => {
    const ok: string[] = []
    eventBus.on('signaling-connected', () => { throw new Error('boom') })
    eventBus.on('signaling-connected', () => ok.push('still runs'))

    expect(() => eventBus.emit('signaling-connected', undefined)).not.toThrow()
    expect(ok).toEqual(['still runs'])
  })
})

// ─── Map 隔离边界测试 ────────────────────────────────────────────────────
// eventBus 有两套独立的 Map：
//   listeners       ← on() / off() 操作
//   unsafeListeners ← onUnsafe() / offUnsafe() 操作
// emit() 查 listeners，emitUnsafe() 查 unsafeListeners，两者永不相交

describe('Map 隔离边界', () => {
  it('on() 注册的监听器，emitUnsafe() 不应触发', () => {
    let called = false
    eventBus.on('signaling-connected', () => { called = true })
    eventBus.emitUnsafe('signaling-connected', undefined)
    expect(called).to.equal(false)
  })

  it('onUnsafe() 注册的监听器，emit() 不应触发', () => {
    let called = false
    eventBus.onUnsafe('signaling-connected', () => { called = true })
    eventBus.emit('signaling-connected', undefined)
    expect(called).to.equal(false)
  })
})

// ─── data-channel-message 集成（模拟 useChat ↔ useWebRTC 路径）──────────
// useChat.init() 用 on() 注册 data-channel-message
// useWebRTC channel.onmessage 用 emit() 发送（修复后）
// 对应真实 bug：useWebRTC 误用 emitUnsafe() 导致消息丢失

describe('data-channel-message 集成（useChat ↔ useWebRTC 场景）', () => {
  it('正向路径：useChat on() 注册 + useWebRTC emit() 发送 → 消息送达', () => {
    const received: unknown[] = []
    const msg = { type: 'chat', text: '你好', sender: 'alice', timestamp: 123456 }

    // 模拟 useChat.init() 注册
    eventBus.on('data-channel-message', (m) => received.push(m))
    // 模拟 useWebRTC channel.onmessage 修复后发送
    eventBus.emit('data-channel-message', msg)

    expect(received).toEqual([msg])
  })

  it('回归测试：useChat on() + useWebRTC 误用 emitUnsafe() → 消息丢失', () => {
    const received: unknown[] = []
    const msg = { type: 'chat', text: '你好', sender: 'alice', timestamp: 123456 }

    eventBus.on('data-channel-message', (m) => received.push(m))
    // 这是 bug 引入前的错误写法
    eventBus.emitUnsafe('data-channel-message', msg)

    // 在 bug 版本下 received = [msg]，测试 fail；修复后 received = []，pass
    expect(received).toEqual([])
  })
})
