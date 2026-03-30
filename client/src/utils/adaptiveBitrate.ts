/**
 * 自适应码率控制器 (Adaptive Bitrate Controller)
 *
 * 基于 WebRTC Stats 的实时网络质量 + 编码器达标率联合评估，
 * 动态调整视频编码码率。
 *
 * 质量等级（网络）：
 *   high   → 丢包 < 1% 且 RTT < 80ms  →  可升码率
 *   medium → 丢包 1-5% 或 RTT 80-300ms → 维持
 *   low    → 丢包 > 5% 或 RTT > 300ms  →  降码率
 *
 * 编码器达标率：
 *   actualBitrate / targetBitrate > 0.8 → 编码器能跟上，可升
 *   actualBitrate / targetBitrate ≤ 0.8 → 编码器受限，暂停升码率
 *
 * 升降码率均有冷却期，防止震荡。
 */

import { useWebRTCStore } from '@/stores'
import { applySenderParameters } from './webrtc-utils'
import { eventBus } from '@/utils/eventBus'

/** 码率调整间隔（ms） */
const ADAPT_INTERVAL_MS = 3000

/** 降码率步进比例（相对当前码率） */
const DOWNGRADE_RATIO = 0.6

/** 升码率步进比例（相对目标码率差值） */
const UPGRADE_RATIO = 0.25

/** 最小码率下限（kbps） */
const MIN_BITRATE_KBPS = 300

/** 最大码率上限（kbps） */
const MAX_BITRATE_KBPS = 25000

/** 升降码率冷却时间（ms） */
const COOLDOWN_MS = 8000

/** 连续降级次数上限 */
const MAX_CONSECUTIVE_DOWNGRADES = 3

/** 编码器达标率阈值：actual / target 高于此值才允许升码率 */
const ENCODER_ACHIEVABLE_RATIO = 0.8

interface QualityMetrics {
  packetLoss: number
  rtt: number
  framerate: number
  /** 上次 stats 采集的实际发送码率（bps） */
  actualBitrateBps: number
}

let adaptInterval: ReturnType<typeof setInterval> | null = null

let lastAdjustTime = 0
let consecutiveDowngrades = 0
let currentTargetKbps = 0

/** 编码器是否受限（actual 持续达不到 target） */
let encoderConstrained = false

/** 编码器受限警告是否已输出（避免重复刷屏） */
let encoderConstrainedWarned = false

/**
 * 核心决策函数
 */
function computeTargetBitrate(
  currentKbps: number,
  maxKbps: number,
  metrics: QualityMetrics
): number {
  const { packetLoss, rtt, actualBitrateBps } = metrics
  const actualKbps = actualBitrateBps / 1000

  const now = Date.now()
  const inCooldown = now - lastAdjustTime < COOLDOWN_MS

  // ── 编码器达标率检测 ────────────────────────────────────────
  if (currentKbps > 0) {
    const ratio = actualKbps / currentKbps
    if (ratio < ENCODER_ACHIEVABLE_RATIO) {
      const wasConstrained = encoderConstrained
      encoderConstrained = true
      if (!wasConstrained) {
        encoderConstrainedWarned = false // 即将输出警告
      }
    } else {
      // 连续达标则解除约束，避免永久锁死
      if (encoderConstrained) {
        console.log(`[ABR] ✓ 编码器达标率恢复: actual=${actualKbps.toFixed(0)}kbps / target=${currentKbps}kbps`)
      }
      encoderConstrained = false
      encoderConstrainedWarned = false
    }
  }

  // ── 冷却期：不决策 ─────────────────────────────────────────
  if (inCooldown) return currentKbps

  // ── 降码率：丢包 > 5% 或 RTT > 300ms（对应注释中的 low 区间） ──────
  if (packetLoss > 5 || rtt > 300) {
    if (consecutiveDowngrades >= MAX_CONSECUTIVE_DOWNGRADES) {
      return Math.max(currentKbps, MIN_BITRATE_KBPS)
    }

    consecutiveDowngrades++
    lastAdjustTime = now

    const newBitrate = Math.max(
      Math.round(currentKbps * DOWNGRADE_RATIO),
      MIN_BITRATE_KBPS
    )

    console.log(
      `[ABR] ↓ 降码率: ${currentKbps}kbps → ${newBitrate}kbps ` +
      `(packetLoss=${packetLoss.toFixed(1)}%, rtt=${rtt}ms, actual=${actualKbps.toFixed(0)}kbps)`
    )

    return newBitrate
  }

  // ── 升码率 ─────────────────────────────────────────────────
  const isHighQuality = packetLoss < 1 && rtt < 80

  // 必须同时满足：网络好 + 编码器未受限 + 未处于降级恢复期
  if (isHighQuality && !encoderConstrained && consecutiveDowngrades === 0) {
    const upgradeStep = Math.round((maxKbps - currentKbps) * UPGRADE_RATIO)
    const newBitrate = Math.min(currentKbps + Math.max(upgradeStep, 500), maxKbps)

    if (newBitrate > currentKbps + 200) {
      lastAdjustTime = now
      console.log(
        `[ABR] ↑ 升码率: ${currentKbps}kbps → ${newBitrate}kbps ` +
        `(packetLoss=${packetLoss.toFixed(1)}%, rtt=${rtt}ms, actual=${actualKbps.toFixed(0)}kbps, ratio=${(actualKbps / currentKbps * 100).toFixed(0)}%)`
      )
    }

    return newBitrate
  }

  // ── 编码器受限说明（仅首次进入受限状态时输出）───────────────
  if (encoderConstrained && !encoderConstrainedWarned && isHighQuality) {
    console.log(
      `[ABR] ⏸ 暂停升码率: actual=${actualKbps.toFixed(0)}kbps / target=${currentKbps}kbps ` +
      `= ${(actualKbps / currentKbps * 100).toFixed(0)}% < ${ENCODER_ACHIEVABLE_RATIO * 100}%（编码器受限）`
    )
    encoderConstrainedWarned = true
  }

  // ── 网络处于 medium 区间（丢包 1-5% 或 RTT 80-300ms）时缓慢恢复降级计数 ──
  // low 区间已在上方 return，能走到这里的只有 medium
  if (!isHighQuality) {
    consecutiveDowngrades = Math.max(0, consecutiveDowngrades - 1)
  }

  return currentKbps
}

function getVideoSender(pc: RTCPeerConnection): RTCRtpSender | null {
  if (!pc) return null
  return pc.getSenders().find(s => s.track?.kind === 'video') ?? null
}

async function doAdapt(): Promise<void> {
  const store = useWebRTCStore()

  if (!store.isStreaming) return

  const pc = store.peerConnection
  if (!pc) return

  const sender = getVideoSender(pc)
  if (!sender) return

  const maxKbps = MAX_BITRATE_KBPS

  const { bitrate, packetLoss, rtt, framerate } = store.performance

  const metrics: QualityMetrics = {
    actualBitrateBps: bitrate,
    packetLoss,
    rtt,
    framerate
  }

  const prev = currentTargetKbps || maxKbps
  const next = computeTargetBitrate(prev, maxKbps, metrics)

  if (next === prev) return

  currentTargetKbps = next

  store.updateAdaptiveBitrate({
    currentBitrateKbps: next,
    qualityTier: encoderConstrained ? 'medium' : 'high'
  })

  await applySenderParameters(sender, next, undefined, true)
}

/**
 * 启动自适应码率控制器
 * @param initialBitrateKbps 初始目标码率（来自 useMediaStream.getTargetBitrate()）
 */
export function startAdaptiveBitrate(initialBitrateKbps: number): void {
  if (adaptInterval) return

  currentTargetKbps = initialBitrateKbps
  consecutiveDowngrades = 0
  lastAdjustTime = 0
  encoderConstrained = false
  encoderConstrainedWarned = false

  const store = useWebRTCStore()
  store.updateAdaptiveBitrate({
    enabled: true,
    currentBitrateKbps: initialBitrateKbps,
    qualityTier: 'high'
  })

  adaptInterval = setInterval(doAdapt, ADAPT_INTERVAL_MS)
  console.log(
    `[ABR] 启动自适应码率控制器，初始码率: ${initialBitrateKbps}kbps`
  )
}

/**
 * 停止自适应码率控制器
 */
export function stopAdaptiveBitrate(): void {
  if (adaptInterval) {
    clearInterval(adaptInterval)
    adaptInterval = null
  }

  currentTargetKbps = 0
  consecutiveDowngrades = 0
  lastAdjustTime = 0
  encoderConstrained = false
  encoderConstrainedWarned = false

  const store = useWebRTCStore()
  store.updateAdaptiveBitrate({ enabled: false })
  console.log('[ABR] 停止自适应码率控制器')
}

// 断线自动停止
eventBus.on('connection-closed', () => {
  stopAdaptiveBitrate()
})
