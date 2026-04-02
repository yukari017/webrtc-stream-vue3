import { ref, onUnmounted } from 'vue'
import { useWebRTCStore } from '@/stores'
import { eventBus } from '@/utils/eventBus'
import type { SignalingMessage } from '@/types/webrtc'
import {
  SIGNALING_SERVER_URL,
  MAX_SIGNALING_RECONNECT,
  SIGNALING_RECONNECT_BASE_MS,
  SIGNALING_RECONNECT_WINDOW_MS,
  SIGNALING_HEARTBEAT_INTERVAL
} from '@/utils/config'

export function useSignaling() {
  const store = useWebRTCStore()

  const reconnectTimer = ref<ReturnType<typeof setTimeout> | null>(null)
  /** 记录当前 waitForConnection 注册的监听器，用于 onUnmounted 兜底清理 */
  const waitForConnListener = ref<(() => void) | null>(null)
  const heartbeatTimer = ref<ReturnType<typeof setInterval> | null>(null)
  const reconnectStartTs = ref<number | null>(null)

  // ─── 连接 ────────────────────────────────────────────────────────────────

  const connectSignaling = (roomId: string): void => {
    if (!roomId) {
      store.updateStatus('请输入房间号', 'error')
      return
    }

    if (store.signalingSocket && store.signalingSocket.readyState === WebSocket.OPEN) {
      return
    }

    if (store.signalingSocket) {
      try {
        store.signalingSocket.close()
      } catch (e) {
        console.warn('清理旧信令 socket 时出错', e)
      }
    }

    const url = `${SIGNALING_SERVER_URL}?room=${encodeURIComponent(roomId)}`
    const socket = new WebSocket(url)

    setupSocketHandlers(socket, roomId)

    store.setSignalingSocket(socket)
    store.setRoom(roomId)
    store.updateStatus(`正在连接信令服务器: ${roomId}`)
  }

  // ─── Socket 事件处理 ───────────────────────────────────────────────────

  const setupSocketHandlers = (socket: WebSocket, roomId: string): void => {
    socket.onopen = () => {
      store.resetReconnectAttempts()
      reconnectStartTs.value = null
      store.setConnected(true)
      store.updateStatus('信令服务器连接成功', 'success')
      startHeartbeat(socket)
      // 通知所有等待连接就绪的调用方（waitForConnection）
      eventBus.emit('signaling-connected', undefined)
    }

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        // 直接处理信令消息
        handleSignalingMessage(data)
      } catch (error) {
        console.error('信令消息解析错误:', error)
      }
    }

    socket.onerror = () => {
      console.error('信令服务器错误')
      store.updateStatus('信令服务器连接错误', 'error')
    }

    socket.onclose = () => {
      stopHeartbeat()
      if (store.isStreaming) {
        handleReconnect(roomId)
      } else {
        store.setConnected(false)
        store.updateStatus('信令连接已关闭')
      }
    }
  }

  // ─── 信令消息路由 ───────────────────────────────────────────────────────

  const handleSignalingMessage = (data: Record<string, unknown>): void => {
    switch (data.type) {
      case 'welcome':
        store.setClientId(data.yourId as string)
        store.updateStatus(
          `已加入房间 ${data.roomId as string} (客户端ID: ${data.yourId as string})`,
          'success'
        )
        break

      case 'room-ready':
        if (store.isStreaming) {
          store.updateStatus('观看端已就绪，正在创建P2P连接...', 'info')
          eventBus.emit('room-ready', undefined)
        }
        break

      case 'peer-disconnected':
        store.updateStatus('对方已断开连接', 'warning')
        eventBus.emit('peer-disconnected', undefined)
        break

      case 'room-full':
        store.updateStatus('房间已满，无法加入', 'error')
        break

      case 'pong':
        break

      default:
        eventBus.emitUnsafe('message', data)
    }
  }

  // ─── 重连 ───────────────────────────────────────────────────────────────

  const handleReconnect = (roomId: string): void => {
    const now = Date.now()
    if (!reconnectStartTs.value) {
      reconnectStartTs.value = now
    }

    const elapsed = now - reconnectStartTs.value

    if (
      elapsed < SIGNALING_RECONNECT_WINDOW_MS &&
      store.signalingReconnectAttempts < MAX_SIGNALING_RECONNECT
    ) {
      const baseDelay =
        SIGNALING_RECONNECT_BASE_MS *
        Math.pow(2, store.signalingReconnectAttempts)
      const delay = Math.min(baseDelay, 15000)

      store.incrementReconnectAttempts()
      store.updateStatus(
        `信令连接断开，${delay / 1000}s后尝试重连（第 ${store.signalingReconnectAttempts} 次）`,
        'warning'
      )

      reconnectTimer.value = setTimeout(() => {
        connectSignaling(roomId)
      }, delay)
    } else {
      store.updateStatus('信令重连失败，已超过自动重连时间窗口或次数上限', 'error')
      store.cleanup()
    }
  }

  // ─── 心跳 ───────────────────────────────────────────────────────────────

  const startHeartbeat = (socket: WebSocket): void => {
    stopHeartbeat()

    heartbeatTimer.value = setInterval(() => {
      try {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'ping', ts: Date.now() }))
        }
      } catch (e) {
        console.warn('心跳发送失败', e)
      }
    }, SIGNALING_HEARTBEAT_INTERVAL)
  }

  const stopHeartbeat = (): void => {
    if (heartbeatTimer.value) {
      clearInterval(heartbeatTimer.value)
      heartbeatTimer.value = null
    }
  }

  // ─── 发送 ───────────────────────────────────────────────────────────────

  const sendMessage = (message: SignalingMessage | Record<string, unknown>): boolean => {
    if (store.signalingSocket && store.signalingSocket.readyState === WebSocket.OPEN) {
      try {
        store.signalingSocket.send(JSON.stringify(message))
        return true
      } catch (error) {
        console.error('发送消息失败:', error)
        store.updateStatus('发送消息失败', 'error')
        return false
      }
    } else {
      store.updateStatus('信令连接未就绪', 'warning')
      return false
    }
  }

  // ─── 等待连接就绪（事件驱动，替代轮询） ────────────────────────────────

  /**
   * 返回一个 Promise，在信令连接建立后 resolve。
   * - 若已连接则立即 resolve
   * - 若超时（默认 10s）则 reject
   * 内部监听 'signaling-connected' 事件，无需轮询
   */
  const waitForConnection = (timeoutMs = 10000): Promise<void> => {
    if (store.isConnected) return Promise.resolve()

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        eventBus.off('signaling-connected', onConnected)
        waitForConnListener.value = null
        reject(new Error('信令连接超时'))
      }, timeoutMs)

      const onConnected = () => {
        clearTimeout(timer)
        eventBus.off('signaling-connected', onConnected) // once 语义：触发后立即 off
        waitForConnListener.value = null
        resolve()
      }

      eventBus.on('signaling-connected', onConnected)
      waitForConnListener.value = onConnected
    })
  }

  // ─── 断开 ───────────────────────────────────────────────────────────────

  const disconnect = (): void => {
    if (reconnectTimer.value) {
      clearTimeout(reconnectTimer.value)
      reconnectTimer.value = null
    }

    stopHeartbeat()

    if (store.signalingSocket) {
      store.signalingSocket.close()
      store.setSignalingSocket(null)
    }

    store.setConnected(false)
    store.updateStatus('已断开信令连接', 'info')
  }

  // ─── 生命周期 ───────────────────────────────────────────────────────────

  onUnmounted(() => {
    if (reconnectTimer.value) {
      clearTimeout(reconnectTimer.value)
    }
    stopHeartbeat()
    // 兜底清理：若组件销毁时 waitForConnection 仍在等待，移除其注册的监听器
    if (waitForConnListener.value) {
      eventBus.off('signaling-connected', waitForConnListener.value)
      waitForConnListener.value = null
    }
  })

  // ─── 代理 eventBus 事件，保持旧 API 兼容 ────────────────────────────────
  // useWebRTC / useChat 内部调用 .on('message', cb) / .on('room-ready', cb)
  // 这里直接透传，调用方无需感知 eventBus 存在

  return {
    connectSignaling,
    disconnect,
    sendMessage,
    waitForConnection,
    on: eventBus.on,
    off: eventBus.off,

    isConnected: () => store.isConnected,
    roomId: () => store.roomId,
    clientId: () => store.clientId
  }
}
