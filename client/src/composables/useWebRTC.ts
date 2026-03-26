import { ref, onUnmounted } from 'vue'
import { useWebRTCStore } from '@/stores'
import { useSignaling } from './useSignaling'
import { useMediaStream } from './useMediaStream'
import { 
  createPeerConnectionConfig,
  applySenderParameters,
  setSdpBandwidth
} from '@/utils/webrtc-utils'
import { 
  MAX_ICE_RESTART, 
  ICE_RESTART_DELAY_MS 
} from '@/utils/config'

// 全局事件监听器
type EventCallback = (...args: unknown[]) => void
const globalListeners: Record<string, EventCallback[]> = {}

export function useWebRTC() {
  const store = useWebRTCStore()
  const signaling = useSignaling()
  const media = useMediaStream()
  
  const isNegotiating = ref(false)
  const iceRestartTimer = ref<ReturnType<typeof setTimeout> | null>(null)
  const pendingOffer = ref<RTCSessionDescriptionInit | null>(null)
  const pendingIceCandidates = ref<RTCIceCandidateInit[]>([])

  // 事件发射器
  const emit = (event: string, ...args: unknown[]): void => {
    if (globalListeners[event]) {
      globalListeners[event].forEach(callback => callback(...args))
    }
  }

  const on = (event: string, callback: EventCallback): void => {
    if (!globalListeners[event]) {
      globalListeners[event] = []
    }
    globalListeners[event].push(callback)
  }

  const off = (event: string, callback: EventCallback): void => {
    if (globalListeners[event]) {
      const index = globalListeners[event].indexOf(callback)
      if (index > -1) {
        globalListeners[event].splice(index, 1)
      }
    }
  }

  // 创建 PeerConnection
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

  // 设置数据通道
  const setupDataChannel = (channel: RTCDataChannel): void => {
    channel.onopen = () => {
      store.updateStatus('数据通道已打开', 'success')
    }
    
    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        emit('data-channel-message', data)
      } catch (error) {
        console.warn('数据通道消息解析失败:', error)
      }
    }
    
    channel.onclose = () => {
      store.updateStatus('数据通道已关闭', 'info')
    }
    
    channel.onerror = (event) => {
      const error = (event as RTCErrorEvent).error
      if (error && (
        error.name === 'OperationError' || 
        error.message?.includes('Close called') ||
        error.message?.includes('User-Initiated Abort')
      )) {
        console.log('数据通道正常关闭')
        return
      }
      
      console.error('数据通道错误:', event)
      store.updateStatus('数据通道错误', 'error')
    }
  }

  // 设置 PeerConnection 事件处理器
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
          emit('connection-closed')
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
      if (store.remoteStream && store.remoteStream.active) {
        return
      }
      
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

  // 创建并发送 Offer
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

  // 处理远程 Offer
  const handleRemoteOffer = async (sdp: RTCSessionDescriptionInit): Promise<void> => {
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

  // 处理远程 Answer
  const handleRemoteAnswer = async (sdp: RTCSessionDescriptionInit): Promise<void> => {
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

  // 处理 ICE Candidate
  const handleRemoteCandidate = async (candidate: RTCIceCandidateInit): Promise<void> => {
    const pc = store.peerConnection
    if (!pc) return
    
    try {
      if (pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
        
        if (pendingIceCandidates.value.length > 0) {
          for (const pendingCandidate of pendingIceCandidates.value) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(pendingCandidate))
            } catch (error) {
              console.warn('添加存储的 ICE candidate 失败:', error)
            }
          }
          pendingIceCandidates.value = []
        }
      } else {
        pendingIceCandidates.value.push(candidate)
      }
    } catch (error) {
      console.warn('添加 ICE candidate 失败:', error)
    }
  }

  // 添加本地流到 PeerConnection
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
    
    setTimeout(() => {
      const senders = pc.getSenders()
      const videoSender = senders.find(s => s.track && s.track.kind === 'video')
      
      if (videoSender) {
        const targetBitrate = media.getTargetBitrate()
        applySenderParameters(videoSender, targetBitrate)
      }
    }, 1000)
    
    store.updateStatus('本地流已添加到 PeerConnection', 'info')
  }

  // 开始推流
  const startStreaming = async (roomId: string, streamType: 'screen' | 'camera' = 'screen'): Promise<boolean> => {
    try {
      signaling.connectSignaling(roomId)
      
      await new Promise<void>((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (store.isConnected) {
            clearInterval(checkInterval)
            resolve()
          }
        }, 100)
        
        setTimeout(() => {
          clearInterval(checkInterval)
          reject(new Error('信令连接超时'))
        }, 10000)
      })
      
      createPeerConnection()
      
      let stream: MediaStream | null = null
      if (streamType === 'screen') {
        stream = store.screenStream || await media.getScreenShareStream()
      } else if (streamType === 'camera') {
        stream = store.localStream || await media.getCameraStream()
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
      store.updateStatus('推流已开始', 'success')
      
      return true
    } catch (error) {
      console.error('开始推流失败:', error)
      store.updateStatus(`开始推流失败: ${(error as Error).message}`, 'error')
      return false
    }
  }

  // 停止推流
  const stopStreaming = (): void => {
    if (store.peerConnection) {
      const pc = store.peerConnection
      store.setPeerConnection(null)
      pc.close()
    }
    
    media.stopAllStreams()
    signaling.disconnect()
    
    store.setStreaming(false)
    store.updateStatus('推流已停止', 'info')
  }

  // 加入观看
  const joinAsViewer = async (roomId: string): Promise<boolean> => {
    try {
      signaling.connectSignaling(roomId)
      
      await new Promise<void>((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (store.isConnected) {
            clearInterval(checkInterval)
            resolve()
          }
        }, 100)
        
        setTimeout(() => {
          clearInterval(checkInterval)
          reject(new Error('信令连接超时'))
        }, 10000)
      })
      
      createPeerConnection()
      
      if (pendingOffer.value) {
        const cachedOffer = pendingOffer.value
        pendingOffer.value = null
        await handleRemoteOffer(cachedOffer)
      }
      
      store.updateStatus('已加入观看房间，等待推流端连接...', 'info')
      
      return true
    } catch (error) {
      console.error('加入观看失败:', error)
      store.updateStatus(`加入观看失败: ${(error as Error).message}`, 'error')
      return false
    }
  }

  // 发送数据通道消息
  const sendDataChannelMessage = (data: unknown): boolean | Promise<boolean> => {
    const pc = store.peerConnection
    if (!pc) return false
    
    try {
      const channel = pc.dataChannel
      
      if (!channel) {
        return new Promise<boolean>((resolve) => {
          let resolved = false
          const checkInterval = setInterval(() => {
            const ch = pc.dataChannel
            if (ch && ch.readyState === 'open') {
              clearInterval(checkInterval)
              if (!resolved) {
                resolved = true
                try {
                  ch.send(JSON.stringify(data))
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
              resolve(false)
            }
          }, 5000)
        })
      }
      
      if (channel.readyState === 'open') {
        channel.send(JSON.stringify(data))
        return true
      } else if (channel.readyState === 'connecting') {
        return new Promise<boolean>((resolve) => {
          const onOpen = () => {
            channel.removeEventListener('open', onOpen)
            channel.send(JSON.stringify(data))
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

  // ICE 重启调度
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

  // 重启 ICE
  const restartIce = async (): Promise<void> => {
    const pc = store.peerConnection
    if (!pc) return
    
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

  // 设置信令消息处理器
  signaling.on('room-ready', () => {
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
  })
  
  signaling.on('message', (data: unknown) => {
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
  })
  
  signaling.on('peer-disconnected', () => {
    emit('connection-closed')
  })
  
  // 清理
  onUnmounted(() => {
    if (iceRestartTimer.value) {
      clearTimeout(iceRestartTimer.value)
    }
    
    stopStreaming()
    signaling.disconnect()
  })
  
  return {
    startStreaming,
    stopStreaming,
    joinAsViewer,
    addLocalStreamToPeerConnection,
    sendDataChannelMessage,
    on,
    off,
    isStreaming: () => store.isStreaming,
    isNegotiating,
    peerConnection: () => store.peerConnection
  }
}
