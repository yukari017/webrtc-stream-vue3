/**
 * webrtc-utils 单元测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getResolutionConstraints,
  getBaseBitrateKbpsForResolution,
  applyQualityPresetToBitrate,
  getSupportedCodecs,
  setVideoContentHint,
  applySenderParameters
} from './webrtc-utils'

// ─── getResolutionConstraints ──────────────────────────────────────────────

describe('getResolutionConstraints()', () => {
  it('720p → 理想 1280×720，最大 1920×1080', () => {
    const c = getResolutionConstraints('720p')
    expect(c.width.ideal).toBe(1280)
    expect(c.height.ideal).toBe(720)
    expect(c.width.max).toBe(1920)
    expect(c.height.max).toBe(1080)
  })

  it('1440p → 理想 2560×1440，最大 3840×2160', () => {
    const c = getResolutionConstraints('1440p')
    expect(c.width.ideal).toBe(2560)
    expect(c.height.ideal).toBe(1440)
  })

  it('未知值 fallback → 1080p', () => {
    const c = getResolutionConstraints('unknown' as never)
    expect(c.width.ideal).toBe(1920)
    expect(c.height.ideal).toBe(1080)
  })
})

// ─── getBaseBitrateKbpsForResolution ──────────────────────────────────────

describe('getBaseBitrateKbpsForResolution()', () => {
  it('720p → 3000 kbps', () => {
    expect(getBaseBitrateKbpsForResolution('720p')).toBe(3000)
  })

  it('1080p → 5000 kbps', () => {
    expect(getBaseBitrateKbpsForResolution('1080p')).toBe(5000)
  })

  it('4K → 20000 kbps', () => {
    expect(getBaseBitrateKbpsForResolution('4k')).toBe(20000)
  })

  it('未知值 → 5000 kbps（1080p 默认）', () => {
    expect(getBaseBitrateKbpsForResolution('unknown' as never)).toBe(5000)
  })
})

// ─── applyQualityPresetToBitrate ──────────────────────────────────────────

describe('applyQualityPresetToBitrate()', () => {
  it('无 preset → 返回原值', () => {
    expect(applyQualityPresetToBitrate(3000)).toBe(3000)
    expect(applyQualityPresetToBitrate(3000, undefined)).toBe(3000)
  })

  it('ultra → 取 max(原值, 20000)', () => {
    expect(applyQualityPresetToBitrate(5000, 'ultra')).toBe(20000)
    expect(applyQualityPresetToBitrate(30000, 'ultra')).toBe(30000)
  })

  it('lossless → 取 max(原值, 40000)', () => {
    expect(applyQualityPresetToBitrate(20000, 'lossless')).toBe(40000)
    expect(applyQualityPresetToBitrate(50000, 'lossless')).toBe(50000)
  })

  it('balanced → 取 max(原值, 5000)', () => {
    expect(applyQualityPresetToBitrate(1000, 'balanced')).toBe(5000)
  })

  it('high → 取 max(原值, 10000)', () => {
    expect(applyQualityPresetToBitrate(2000, 'high')).toBe(10000)
  })
})

// ─── getSupportedCodecs ────────────────────────────────────────────────────
// 注意：RTCRtpSender.getCapabilities 是浏览器专有 API，happy-dom 无此对象。
// 在真实浏览器环境或 Node.js + @webrtc/adapter 时才有意义。

describe('getSupportedCodecs()', () => {
  it('无 WebRTC 支持时（RTCRtpSender 不可用）返回兜底 [h264]', () => {
    // 生产代码已有 try-catch 兜底，这里直接验证返回值
    const codecs = getSupportedCodecs()
    expect(Array.isArray(codecs)).toBe(true)
    expect(codecs).toContain('h264')
  })
})

// ─── setVideoContentHint ──────────────────────────────────────────────────

describe('setVideoContentHint()', () => {
  it('非 MediaStreamTrack 入参 → 返回 false，不抛错', () => {
    const result = setVideoContentHint(null as never)
    expect(result).toBe(false)
  })
})

// ─── applySenderParameters ──────────────────────────────────────────────

describe('applySenderParameters()', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  /** sender.track.kind !== 'video' → 返回 false */
  it('非视频 track → 返回 false', async () => {
    const fakeSender = {
      track: { kind: 'audio' },
      getParameters: vi.fn(),
      setParameters: vi.fn()
    } as unknown as RTCRtpSender

    const result = await applySenderParameters(fakeSender, 5000)
    expect(result).toBe(false)
    expect(fakeSender.getParameters).not.toHaveBeenCalled()
  })

  /** getParameters() 抛错 → 捕获后返回 false */
  it('getParameters 抛错 → 返回 false，不抛异常', async () => {
    const fakeSender = {
      track: { kind: 'video' },
      getParameters: vi.fn(() => { throw new Error('boom') }),
      setParameters: vi.fn()
    } as unknown as RTCRtpSender

    const result = await applySenderParameters(fakeSender, 5000)
    expect(result).toBe(false)
  })

  /** setParameters() 抛错 → 捕获后返回 false */
  it('setParameters 抛错 → 返回 false，不抛异常', async () => {
    const fakeSender = {
      track: { kind: 'video' },
      getParameters: vi.fn(() => ({
        encodings: [{ active: true, maxBitrate: 1000, scaleResolutionDownBy: 1 }],
        codecs: []
      })),
      setParameters: vi.fn(() => { throw new Error('read-only') })
    } as unknown as RTCRtpSender

    const result = await applySenderParameters(fakeSender, 5000)
    expect(result).toBe(false)
  })

  /** 正常调用 → setParameters 收到只含可写字段的 encodings */
  it('正常调用 → encodings 只含可写字段（不含 ssrc/rtx）', async () => {
    const setParamsMock = vi.fn()
    const fakeSender = {
      track: { kind: 'video' },
      getParameters: vi.fn(() => ({
        encodings: [
          // 模拟浏览器返回的只读字段（getParameters 返回的是快照）
          { active: true, maxBitrate: 1000, scaleResolutionDownBy: 1, ssrc: 1234, rtx: 5678 }
        ],
        codecs: []
      })),
      setParameters: setParamsMock
    } as unknown as RTCRtpSender

    await applySenderParameters(fakeSender, 8000)

    expect(setParamsMock).toHaveBeenCalledTimes(1)
    const [sentParams] = setParamsMock.mock.calls[0] as [RTCRtpSendParameters]

    // encodings 必须是新构造的对象（不含只读字段）
    expect(sentParams.encodings).toBeDefined()
    expect(sentParams.encodings.length).toBe(1)
    expect((sentParams.encodings[0] as Record<string, unknown>).hasOwnProperty('ssrc')).toBe(false)
    expect((sentParams.encodings[0] as Record<string, unknown>).hasOwnProperty('rtx')).toBe(false)
    // 可写字段存在
    expect(sentParams.encodings[0].maxBitrate).toBe(8_000_000)
    expect(sentParams.encodings[0].active).toBe(true)
    expect(sentParams.encodings[0].scaleResolutionDownBy).toBe(1)
  })
})
