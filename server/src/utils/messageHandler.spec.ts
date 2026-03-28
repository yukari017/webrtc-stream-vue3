/**
 * MessageHandler 单元测试
 * 使用 ws 模块的 mock WebSocket，不启动真实服务器
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MessageHandler } from './messageHandler'

// ─── Mock RoomManager ────────────────────────────────────────────────────

const makeMockWs = (overrides: Partial<{ id: string; roomId: string; send: ReturnType<typeof vi.fn> }> = {}) => ({
  id: 'client-1',
  roomId: 'room-A',
  send: vi.fn(),
  ...overrides
})

const makeMockRoomManager = () => {
  const broadcasts: object[] = []
  const sends: { targetId: string; message: object }[] = []

  return {
    broadcasts,
    sends,
    broadcast: vi.fn((roomId: string, message: object, _sender?: object) => {
      broadcasts.push(message)
    }),
    sendTo: vi.fn((roomId: string, targetId: string, message: object, _sender?: object) => {
      sends.push({ targetId, message })
    })
  }
}

// ─── 测试 ─────────────────────────────────────────────────────────────────

describe('MessageHandler', () => {
  let handler: MessageHandler
  let mockWs: ReturnType<typeof makeMockWs>
  let mockRm: ReturnType<typeof makeMockRoomManager>

  beforeEach(() => {
    mockWs = makeMockWs()
    mockRm = makeMockRoomManager()
    handler = new MessageHandler(mockRm as never)
    vi.clearAllMocks()
  })

  // ── JSON 解析异常 ─────────────────────────────────────────────────────

  describe('非法输入', () => {
    it('非 JSON 字符串 → 无任何副作用', () => {
      handler.handle(mockWs as never, 'not json {')
      expect(mockRm.broadcast).not.toHaveBeenCalled()
    })

    it('缺少 type 字段 → 跳过', () => {
      handler.handle(mockWs as never, '{"foo":"bar"}')
      expect(mockRm.broadcast).not.toHaveBeenCalled()
    })

    it('type 为数字 → 跳过（类型守卫）', () => {
      handler.handle(mockWs as never, '{"type": 123}')
      expect(mockRm.broadcast).not.toHaveBeenCalled()
    })
  })

  // ── ping / pong ────────────────────────────────────────────────────────

  describe('ping', () => {
    it('发送 ping → 回送 pong 并更新时间戳', () => {
      const before = Date.now()
      handler.handle(mockWs as never, '{"type":"ping"}')
      const after = Date.now()

      expect(mockWs.send).toHaveBeenCalledTimes(1)
      const sent = JSON.parse(mockWs.send.mock.calls[0][0])
      expect(sent.type).toBe('pong')
      expect(sent.ts).toBeGreaterThanOrEqual(before)
      expect(sent.ts).toBeLessThanOrEqual(after)
    })
  })

  // ── offer / answer / candidate 广播 ───────────────────────────────────

  describe('信令消息 — 广播', () => {
    it('offer → 广播，附加 from 字段', () => {
      handler.handle(mockWs as never, JSON.stringify({
        type: 'offer',
        sdp: { type: 'offer', sdp: 'v=0...' }
      }))

      expect(mockRm.broadcast).toHaveBeenCalledWith('room-A', expect.any(Object), mockWs)
      const [, msg] = mockRm.broadcast.mock.calls[0]
      expect((msg as Record<string, unknown>).type).toBe('offer')
      expect((msg as Record<string, unknown>).from).toBe('client-1')
    })

    it('answer → 广播', () => {
      handler.handle(mockWs as never, JSON.stringify({
        type: 'answer',
        sdp: { type: 'answer', sdp: 'v=0...' }
      }))
      expect(mockRm.broadcast).toHaveBeenCalledTimes(1)
    })

    it('candidate → 广播', () => {
      handler.handle(mockWs as never, JSON.stringify({
        type: 'candidate',
        candidate: { candidate: 'foo' }
      }))
      expect(mockRm.broadcast).toHaveBeenCalledTimes(1)
    })
  })

  // ── offer / answer / candidate 单点路由 ─────────────────────────────────

  describe('信令消息 — 单点路由 (to 字段)', () => {
    it('offer 含 to → sendTo，broadcast 不调用', () => {
      handler.handle(mockWs as never, JSON.stringify({
        type: 'offer',
        to: 'client-2',
        sdp: { type: 'offer', sdp: 'v=0...' }
      }))

      expect(mockRm.broadcast).not.toHaveBeenCalled()
      expect(mockRm.sendTo).toHaveBeenCalledTimes(1)
      expect(mockRm.sendTo.mock.calls[0][1]).toBe('client-2')
    })

    it('answer 含 to → sendTo', () => {
      handler.handle(mockWs as never, JSON.stringify({
        type: 'answer',
        to: 'client-3',
        sdp: { type: 'answer', sdp: 'v=0...' }
      }))
      expect(mockRm.sendTo).toHaveBeenCalledWith('room-A', 'client-3', expect.any(Object), mockWs)
    })

    it('candidate 含 to → sendTo', () => {
      handler.handle(mockWs as never, JSON.stringify({
        type: 'candidate',
        to: 'client-4',
        candidate: { candidate: 'a=b' }
      }))
      expect(mockRm.sendTo).toHaveBeenCalledTimes(1)
    })
  })

  // ── chat-message ───────────────────────────────────────────────────────

  describe('chat-message', () => {
    it('发送聊天 → 广播，附加 from + timestamp', () => {
      handler.handle(mockWs as never, JSON.stringify({
        type: 'chat-message',
        text: 'Hello world'
      }))

      expect(mockRm.broadcast).toHaveBeenCalledTimes(1)
      const [, msg] = mockRm.broadcast.mock.calls[0] as [string, Record<string, unknown>]
      expect(msg.type).toBe('chat-message')
      expect(msg.text).toBe('Hello world')
      expect(msg.from).toBe('client-1')
      expect(typeof msg.timestamp).toBe('number')
    })

    it('超长文本 → 截断至 500 字符', () => {
      const longText = 'x'.repeat(1000)
      handler.handle(mockWs as never, JSON.stringify({
        type: 'chat-message',
        text: longText
      }))

      const [, msg] = mockRm.broadcast.mock.calls[0] as [string, Record<string, unknown>]
      expect((msg.text as string).length).toBe(500)
    })

    it('首尾空格 → trim', () => {
      handler.handle(mockWs as never, JSON.stringify({
        type: 'chat-message',
        text: '  Hi  '
      }))

      const [, msg] = mockRm.broadcast.mock.calls[0] as [string, Record<string, unknown>]
      expect(msg.text).toBe('Hi')
    })

    it('空文本 → trim 后为空，广播时 text 为空字符串', () => {
      handler.handle(mockWs as never, JSON.stringify({
        type: 'chat-message',
        text: '   '
      }))

      expect(mockRm.broadcast).toHaveBeenCalledTimes(1)
      const [, msg] = mockRm.broadcast.mock.calls[0] as [string, Record<string, unknown>]
      expect(msg.text).toBe('')
    })
  })

  // ── 未知类型 ──────────────────────────────────────────────────────────

  describe('未知消息类型', () => {
    it('未知 type → 跳过（不抛错）', () => {
      expect(() => handler.handle(mockWs as never, '{"type":"unknown-type"}')).not.toThrow()
      expect(mockRm.broadcast).not.toHaveBeenCalled()
    })
  })
})
