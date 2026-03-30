import { ref, onUnmounted } from 'vue'
import { useWebRTCStore } from '@/stores'
import { useSignaling } from './useSignaling'
import { useMediaStream } from './useMediaStream'
import {
  createPeerConnectionConfig,
  applySenderParameters,
  setSdpBandwidth
} from '@/utils/webrtc-utils'
import { eventBus } from '@/utils/eventBus'
import {
  startAdaptiveBitrate,
  stopAdaptiveBitrate
} from '@/utils/adaptiveBitrate'
import {
  MAX_ICE_RESTART,
  ICE_RESTART_DELAY_MS
} from '@/utils/config'

/** ICE Candidate 暂存最大容量，防止内存耗尽 */
const MAX_PENDING_CANDIDATES = 10

export function useWebRTC() {
  const store = useWebRTCStore()
  const signaling = useSignaling()
  const media = useMediaStream()

  const isNegotiating = ref(false)
  const iceRestartTimer = ref<ReturnType<typeof setTimeout> | null>(null)
  const pendingOffer = ref<RTCSessionDescriptionInit | null>(null)

  /** ICE Candidate 暂存队列（容量上限 MAX_PENDING_CANDIDATES） */
  const pendingIceCandidates = ref<
    { candidate: RTCIceCandidateInit; ts: number }[]
  >([])

  // ─── 性能数据采集 ───────────────────────────────────────────────────────

  let statsInterval: ReturnType<typeof setInterval> | null = null

  // 用于计算码率的持久状态（存储在 statsInterval 闭包外）
  let lastBytesSent = 0
  let lastBytesSentTime = 0

  const startStatsCollection = (): void => {
    stopStatsCollection()
    lastBytesSent = 0
    lastBytesSentTime = Date.now()

    statsInterval = setInterval(async () => {
      const pc = store.peerConnection
      if (!pc) return

      try {
        const stats = await pc.getStats()
        let framerate = store.performance.framerate
        let packetLoss = store.performance.packetLoss
        let rtt = store.performance.rtt
        let bitrate = store.performance.bitrate

        stats.forEach(report => {
          // ── 推流端：从 remote-inbound-rtp 获取对端真实丢包率和 RTT ──────
          // outbound-rtp 只能看自己发了多少，remote-inbound-rtp 才是对端收到的质量
          // 观看端：从 inbound-rtp 获取本端收到的丢包率
          if (store.isStreaming) {
            // 推流端帧率：outbound-rtp
            if (report.type === 'outbound-rtp' && report.kind === 'video') {
              const fps = (report as RTCStats & { framesPerSecond?: number }).framesPerSecond
              if (fps !== undefined) framerate = fps

              // 推流端码率：基于 bytesSent 差值计算
              if (report.bytesSent !== undefined && report.bytesSent > 0) {
                const now = Date.now()
                if (lastBytesSent > 0 && now > lastBytesSentTime) {
                  const deltaBytes = report.bytesSent - lastBytesSent
                  const deltaSec = (now - lastBytesSentTime) / 1000
                  bitrate = Math.round((deltaBytes * 8) / deltaSec)
                }
                lastBytesSent = report.bytesSent
                lastBytesSentTime = now
              }
            }

            // 推流端丢包率 + RTT：remote-inbound-rtp（对端反馈，ABR 决策依据）
            if (report.type === 'remote-inbound-rtp' && report.kind === 'video') {
              if (report.packetsLost !== undefined && report.packetsReceived !== undefined) {
                const total = report.packetsLost + report.packetsReceived
                packetLoss = total > 0 ? (report.packetsLost / total) * 100 : 0
              }
              // remote-inbound-rtp 直接携带 RTT（单位：秒）
              if (report.roundTripTime !== undefined) {
                rtt = Math.round(report.roundTripTime * 1000)
              }
            }
          } else {
            // 观看端：从 inbound-rtp 获取本端收到的质量数据
            if (report.type === 'inbound-rtp' && report.kind === 'video') {
              const fps = (report as RTCStats & { framesPerSecond?: number }).framesPerSecond
              if (fps !== undefined) framerate = fps
              if (report.packetsLost !== undefined && report.packetsReceived !== undefined) {
                const total = report.packetsLost + report.packetsReceived
                packetLoss = total > 0 ? (report.packetsLost / total) * 100 : 0
              }
            }

            // 观看端 RTT：candidate-pair
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              if (report.currentRoundTripTime !== undefined) {
                rtt = Math.round(report.currentRoundTripTime * 1000)
              }
            }
          }
        })

        store.updatePerformance({ bitrate, framerate, packetLoss, rtt })
      } catch {
        // stats 采集失败，静默忽略
      }
    }, 2000)
  }

  const stopStatsCollection = (): void => {
    if (statsInterval) {
      clearInterval(statsInterval)
      statsInterval = null
    }
  }

  // ─── Data Channel 设置 ─────────────────────────────────────────────────

  /**
   * DataChannel 互斥锁
   * 推流端（isStreaming）等待 Viewer 发来 "datachannel-ready" 后才认为可写
   * 观看端（!isStreaming）DataChannel open 后主动发送 "datachannel-ready"
   * 使用 ref 确保重连时状态可被正确重置
   */
  const dataChannelReady = ref(false)

  const setupDataChannel = (channel: RTCDataChannel): void => {
    // 重连时重置状态
    dataChannelReady.value = false
    pendingMessages.value = [] // 清空旧队列

    channel.onopen = () => {
      store.updateStatus('数据通道已打开', 'success')

      // 观看端：DataChannel open 后通知推流端可以开始发消息了
      if (!store.isStreaming) {
        const msg = JSON.stringify({ type: 'datachannel-ready' })
        if (channel.readyState === 'open') {
          channel.send(msg)
        } else {
          // readyState 可能还是 connecting，延迟发送
          const waitForOpen = setInterval(() => {
            if (channel.readyState === 'open') {
              clearInterval(waitForOpen)
              channel.send(msg)
            }
          }, 50)
        }
      }
    }

    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        // 推流端：收到 Viewer 的 "datachannel-ready" 后解锁发送
        if (
          store.isStreaming &&
          (data as Record<string, unknown>).type === 'datachannel-ready'
        ) {
          dataChannelReady.value = true
          store.updateStatus('数据通道就绪，可以开始聊天了', 'success')
          return
        }

        eventBus.emit('data-channel-message', data)
      } catch (error) {
        console.warn('数据通道消息解析失败:', error)
      }
    }

    channel.onclose = () => {
      dataChannelReady.value = false // 关闭时重置
      store.updateStatus('数据通道已关闭', 'info')
    }

    channel.onerror = (event) => {
      const error = (event as RTCErrorEvent).error
      if (
        error &&
        (error.name === 'OperationError' ||
          error.message?.includes('Close called') ||
          error.message?.includes('User-Initiated Abort'))
      ) {
        return // 正常关闭，忽略
      }
      console.error('数据通道错误:', event)
      store.updateStatus('数据通道错误', 'error')
    }
  }

  // ─── PeerConnection 事件处理 ────────────────────────────────────────────

  const setupPeerConnectionHandlers = (pc: RTCPeerConnection): void => {
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        signaling.sendMessage({
          type: 'candidate',
          candidate: event.candidate.toJSON()
        })
      }
    }

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState
      store.updateStatus(`ICE 连接状态: ${state}`, 'info')

      switch (state) {
        case 'connected':
        case 'completed':
          store.updateStatus('P2P 连接已建立', 'success')
          break
        case 'disconnected':
          store.updateStatus('P2P 连接断开，尝试恢复...', 'warning')
          scheduleIceRestart()
          break
        case 'failed':
          store.updateStatus('P2P 连接失败', 'error')
          scheduleIceRestart()
          break
        case 'closed':
          store.updateStatus('P2P 连接已关闭', 'info')
          eventBus.emit('connection-closed')
          break
      }
    }

    pc.onsignalingstatechange = () => {
      store.updateStatus(`信令状态: ${pc.signalingState}`, 'info')
    }

    pc.onnegotiationneeded = async () => {
      if (!store.isStreaming) return
      if (pc.signalingState !== 'stable') return
      if (isNegotiating.value) return

      isNegotiating.value = true
      try {
        await createAndSendOffer()
      } catch (error) {
        console.error('协商失败:', error)
        store.updateStatus('P2P 协商失败', 'error')
      } finally {
        isNegotiating.value = false
      }
    }

    pc.ontrack = (event) => {
      if (store.remoteStream && store.remoteStream.active) return

      if (event.streams && event.streams[0]) {
        store.setRemoteStream(event.streams[0])
        store.updateStatus('接收到远程视频流', 'success')
      } else {
        console.warn('未接收到有效的远程流')
      }
    }

    pc.ondatachannel = (event) => {
      const channel = event.channel
      setupDataChannel(channel)
      pc.dataChannel = channel
    }
  }

  // ─── PeerConnection 生命周期 ───────────────────────────────────────────

  const createPeerConnection = (): RTCPeerConnection => {
    if (store.peerConnection) {
      try {
        store.peerConnection.close()
      } catch (e) {
        console.warn('关闭旧 PeerConnection 时出错:', e)
      }
    }

    const config = createPeerConnectionConfig()
    const pc = new RTCPeerConnection(config)

    setupPeerConnectionHandlers(pc)
    store.setPeerConnection(pc)
    store.updateStatus('PeerConnection 创建成功', 'success')

    return pc
  }

  // ─── Offer / Answer / Candidate ─────────────────────────────────────────

  const createAndSendOffer = async (restartIce = false): Promise<void> => {
    const pc = store.peerConnection
    if (!pc) return
    if (pc.signalingState === 'have-local-offer') return
    if (pc.signalingState !== 'stable') return

    try {
      const targetBitrate = media.getTargetBitrate()
      const offerOptions: RTCOfferOptions = restartIce ? { iceRestart: true } : {}
      const offer = await pc.createOffer(offerOptions)
      offer.sdp = setSdpBandwidth(offer.sdp, targetBitrate)
      await pc.setLocalDescription(offer)

      signaling.sendMessage({
        type: 'offer',
        sdp: pc.localDescription as RTCSessionDescriptionInit
      })
      store.updateStatus('已发送 Offer', 'info')
    } catch (error) {
      console.error('创建 Offer 失败:', error)
    }
  }

  const handleRemoteOffer = async (
    sdp: RTCSessionDescriptionInit
  ): Promise<void> => {
    const pc = store.peerConnection
    if (!pc) {
      pendingOffer.value = sdp
      return
    }
    if (pc.signalingState !== 'stable') return

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      signaling.sendMessage({
        type: 'answer',
        sdp: pc.localDescription as RTCSessionDescriptionInit
      })
      store.updateStatus('已发送 Answer', 'info')
    } catch {
      // 静默处理重复 offer 导致的错误
    }
  }

  const handleRemoteAnswer = async (
    sdp: RTCSessionDescriptionInit
  ): Promise<void> => {
    const pc = store.peerConnection
    if (!pc) return
    if (pc.signalingState !== 'have-local-offer') return

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp))
      store.updateStatus('已设置远程 Answer', 'info')
    } catch {
      // 静默处理重复 answer 导致的错误
    }
  }

  const handleRemoteCandidate = async (
    candidate: RTCIceCandidateInit
  ): Promise<void> => {
    const pc = store.peerConnection
    if (!pc) return

    // 容量保护：超出上限时丢弃最旧的
    if (pendingIceCandidates.value.length >= MAX_PENDING_CANDIDATES) {
      pendingIceCandidates.value.shift()
      console.warn(
        `pendingIceCandidates 超过上限 ${MAX_PENDING_CANDIDATES}，丢弃最旧的候选`
      )
    }

    if (pc.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))

        // remoteDescription 就绪后，批量处理 pending
        if (pendingIceCandidates.value.length > 0) {
          const pending = [...pendingIceCandidates.value]
          pendingIceCandidates.value = []
          for (const { candidate: p } of pending) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(p))
            } catch (err) {
              console.warn('添加存储的 ICE candidate 失败:', err)
            }
          }
        }
      } catch (error) {
        console.warn('添加 ICE candidate 失败:', error)
      }
    } else {
      // 暂存，带时间戳供后续清理
      pendingIceCandidates.value.push({ candidate, ts: Date.now() })
    }
  }

  // ─── 流操作 ─────────────────────────────────────────────────────────────

  const addLocalStreamToPeerConnection = (stream: MediaStream | null): void => {
    const pc = store.peerConnection
    if (!pc || !stream) return

    const oldSenders = pc.getSenders()
    oldSenders.forEach(sender => {
      if (sender.track) {
        pc.removeTrack(sender)
      }
    })

    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream)
    })

    // addTrack 后 sender.getParameters().encodings 尚未填充（协商未完成）
    // 等信令状态回到 stable（offer/answer 交换完毕）再应用编码参数，替代 setTimeout 硬等
    const applyOnStable = (): void => {
      if (pc.signalingState !== 'stable') return
      pc.removeEventListener('signalingstatechange', applyOnStable)

      const videoSender = pc.getSenders().find(
        s => s.track && s.track.kind === 'video'
      )
      if (videoSender) {
        const targetBitrate = media.getTargetBitrate()
        applySenderParameters(videoSender, targetBitrate).catch(e => {
          console.warn('applySenderParameters 失败:', e)
        })
      }
    }

    if (pc.signalingState === 'stable') {
      // 已经是 stable（如 ICE restart 场景），直接应用
      applyOnStable()
    } else {
      pc.addEventListener('signalingstatechange', applyOnStable)
    }

    store.updateStatus('本地流已添加到 PeerConnection', 'info')
  }

  // ─── 推流 / 观看 ────────────────────────────────────────────────────────

  const startStreaming = async (
    roomId: string,
    streamType: 'screen' | 'camera' = 'screen'
  ): Promise<boolean> => {
    try {
      signaling.connectSignaling(roomId)

      // 事件驱动等待，替代 setInterval 轮询
      await signaling.waitForConnection()

      createPeerConnection()

      let stream: MediaStream | null = null
      if (streamType === 'screen') {
        stream = store.screenStream || (await media.getScreenShareStream())
      } else if (streamType === 'camera') {
        stream = store.localStream || (await media.getCameraStream())
      }

      if (!stream) {
        throw new Error('获取媒体流失败')
      }

      let audioStream: MediaStream | null = null
      if (store.settings.shareAudio && store.selectedAudioDeviceId) {
        audioStream = await media.getAudioInputStream()
        if (audioStream && audioStream.getAudioTracks().length > 0) {
          stream = media.mergeStreams(stream, audioStream) || stream
        }
      }

      addLocalStreamToPeerConnection(stream)

      const pc = store.peerConnection
      if (pc) {
        const dataChannel = pc.createDataChannel('chat')
        setupDataChannel(dataChannel)
        pc.dataChannel = dataChannel
      }

      store.setStreaming(true)
      startStatsCollection()
      startAdaptiveBitrate(media.getTargetBitrate())
      store.updateStatus('推流已开始', 'success')

      return true
    } catch (error) {
      console.error('开始推流失败:', error)
      store.updateStatus(
        `开始推流失败: ${(error as Error).message}`,
        'error'
      )
      return false
    }
  }

  const stopStreaming = (): void => {
    stopAdaptiveBitrate()
    stopStatsCollection()

    if (store.peerConnection) {
      const pc = store.peerConnection
      // 先关再清，避免 setPeerConnection(null) 里 close 一次，这里又 close 一次
      pc.close()
      store.setPeerConnection(null)
    }

    media.stopAllStreams()
    signaling.disconnect()

    store.setStreaming(false)
    store.updateStatus('推流已停止', 'info')
  }

  const joinAsViewer = async (roomId: string): Promise<boolean> => {
    try {
      signaling.connectSignaling(roomId)

      // 事件驱动等待，替代 setInterval 轮询
      await signaling.waitForConnection()

      createPeerConnection()

      if (pendingOffer.value) {
        const cachedOffer = pendingOffer.value
        pendingOffer.value = null
        await handleRemoteOffer(cachedOffer)
      }

      startStatsCollection()
      store.updateStatus('已加入观看房间，等待推流端连接...', 'info')

      return true
    } catch (error) {
      console.error('加入观看失败:', error)
      store.updateStatus(
        `加入观看失败: ${(error as Error).message}`,
        'error'
      )
      return false
    }
  }

  // ─── 数据通道 ───────────────────────────────────────────────────────────

  /**
   * 待发送消息队列（DataChannel 互斥锁开启时暂存）
   * 上限 MAX_PENDING_MESSAGES 条，超出时丢弃最旧的消息，防止内存无限增长
   * 使用 ref 确保重连时可被正确清空
   */
  const MAX_PENDING_MESSAGES = 50
  const pendingMessages = ref<string[]>([])

  const flushPendingMessages = (channel: RTCDataChannel): void => {
    while (pendingMessages.value.length > 0 && channel.readyState === 'open') {
      const msg = pendingMessages.value.shift()
      if (msg) {
        try {
          channel.send(msg)
        } catch {
          // 发送失败，丢弃该消息
        }
      }
    }
  }

  const sendDataChannelMessage = (data: unknown): boolean | Promise<boolean> => {
    const pc = store.peerConnection
    if (!pc) return false

    try {
      const channel = pc.dataChannel
      const msgStr = JSON.stringify(data)

      // ── 推流端：等待 Viewer 发来 datachannel-ready ─────────────────────
      if (store.isStreaming) {
        if (dataChannelReady.value && channel?.readyState === 'open') {
          channel.send(msgStr)
          return true
        }

        // 未就绪，暂存消息；超出上限时丢弃最旧的一条
        if (pendingMessages.value.length >= MAX_PENDING_MESSAGES) {
          console.warn(`pendingMessages 已达上限 ${MAX_PENDING_MESSAGES}，丢弃最旧消息`)
          pendingMessages.value.shift()
        }
        pendingMessages.value.push(msgStr)
        setTimeout(() => {
          const ch = pc.dataChannel
          if (ch && ch.readyState === 'open') {
            flushPendingMessages(ch)
          }
        }, 50)
        return true
      }

      // ── 观看端：等待 channel open ──────────────────────────────────────
      if (!channel) {
        return new Promise<boolean>(resolve => {
          let resolved = false
          const checkInterval = setInterval(() => {
            const ch = pc.dataChannel
            if (ch && ch.readyState === 'open') {
              clearInterval(checkInterval)
              if (!resolved) {
                resolved = true
                try {
                  ch.send(msgStr)
                  resolve(true)
                } catch {
                  resolve(false)
                }
              }
            }
          }, 100)

          setTimeout(() => {
            clearInterval(checkInterval)
            if (!resolved) {
              resolved = true
              resolve(false) // 超时，明确 resolve(false)，避免 Promise 永远挂起
            }
          }, 5000)
        })
      }

      if (channel.readyState === 'open') {
        channel.send(msgStr)
        return true
      } else if (channel.readyState === 'connecting') {
        return new Promise<boolean>(resolve => {
          const onOpen = () => {
            channel.removeEventListener('open', onOpen)
            channel.send(msgStr)
            resolve(true)
          }
          channel.addEventListener('open', onOpen)

          setTimeout(() => {
            channel.removeEventListener('open', onOpen)
            resolve(false)
          }, 5000)
        })
      }

      return false
    } catch (error) {
      console.error('发送数据通道消息失败:', error)
      return false
    }
  }

  // ─── ICE 重启 ───────────────────────────────────────────────────────────

  const scheduleIceRestart = (): void => {
    if (store.iceRestartAttempts >= MAX_ICE_RESTART) {
      store.updateStatus('ICE 重启次数已达上限', 'error')
      return
    }

    if (iceRestartTimer.value) {
      clearTimeout(iceRestartTimer.value)
    }

    store.incrementIceRestartAttempts()

    iceRestartTimer.value = setTimeout(() => {
      restartIce()
    }, ICE_RESTART_DELAY_MS)
  }

  const restartIce = async (): Promise<void> => {
    const pc = store.peerConnection
    if (!pc) return

    // 只有推流端发起 ICE restart offer，观看端等对端 offer 后自动应答
    if (!store.isStreaming) {
      store.updateStatus('观看端等待对端发起 ICE restart', 'info')
      return
    }

    try {
      const offer = await pc.createOffer({ iceRestart: true })
      await pc.setLocalDescription(offer)

      signaling.sendMessage({
        type: 'offer',
        sdp: pc.localDescription as RTCSessionDescriptionInit
      })

      store.updateStatus('ICE 重启已发起', 'info')
    } catch (error) {
      console.error('ICE 重启失败:', error)
      store.updateStatus('ICE 重启失败', 'error')
    }
  }

  // ─── eventBus 事件订阅 ─────────────────────────────────────────────────

  // 保存具名引用，onUnmounted 时用同一引用 off，防止监听器叠加泄漏
  const onRoomReady = (): void => {
    if (store.isStreaming) {
      const pc = store.peerConnection

      if (!pc) {
        createPeerConnection()

        const newPc = store.peerConnection
        if (newPc) {
          const dataChannel = newPc.createDataChannel('chat')
          setupDataChannel(dataChannel)
          newPc.dataChannel = dataChannel
        }

        let stream: MediaStream | null = null
        if (store.screenStream) {
          stream = store.screenStream
        } else if (store.localStream) {
          stream = store.localStream
        }

        if (stream) {
          addLocalStreamToPeerConnection(stream)

          setTimeout(() => {
            createAndSendOffer()
          }, 500)
        }
      } else if (pc.signalingState === 'have-local-offer') {
        signaling.sendMessage({
          type: 'offer',
          sdp: pc.localDescription as RTCSessionDescriptionInit
        })
        store.updateStatus('已重新发送 Offer', 'info')
      } else if (pc.signalingState === 'stable' && !isNegotiating.value) {
        createAndSendOffer()
      }
    }
  }

  const onMessage = (data: unknown): void => {
    const msg = data as Record<string, unknown>
    switch (msg.type) {
      case 'offer':
        handleRemoteOffer(msg.sdp as RTCSessionDescriptionInit)
        break
      case 'answer':
        handleRemoteAnswer(msg.sdp as RTCSessionDescriptionInit)
        break
      case 'candidate':
        handleRemoteCandidate(msg.candidate as RTCIceCandidateInit)
        break
      default:
        console.warn('未知消息类型:', msg.type)
    }
  }

  const onPeerDisconnected = (): void => {
    eventBus.emit('connection-closed')
  }

  eventBus.on('room-ready', onRoomReady)
  eventBus.on('message', onMessage)
  eventBus.on('peer-disconnected', onPeerDisconnected)

  // ─── 清理 ───────────────────────────────────────────────────────────────

  onUnmounted(() => {
    // 取消所有 eventBus 订阅，防止组件重挂载时监听器叠加
    eventBus.off('room-ready', onRoomReady)
    eventBus.off('message', onMessage)
    eventBus.off('peer-disconnected', onPeerDisconnected)

    if (iceRestartTimer.value) {
      clearTimeout(iceRestartTimer.value)
    }
    stopStatsCollection()
    stopStreaming()
  })

  return {
    startStreaming,
    stopStreaming,
    joinAsViewer,
    addLocalStreamToPeerConnection,
    sendDataChannelMessage,
    on: eventBus.on,
    off: eventBus.off,

    isStreaming: () => store.isStreaming,
    isNegotiating,
    peerConnection: () => store.peerConnection
  }
}
