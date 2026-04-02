import { computed, onUnmounted } from 'vue'
import { useWebRTCStore } from '@/stores'
import { eventBus } from '@/utils/eventBus'
import { escapeHtml } from '@/utils/ui-utils'
import type { ChatMessage, LocalChatMessage } from '@/types/webrtc'

export type { LocalChatMessage }

// ─── 全局防护：防止多个 useChat 实例重复注册监听器 ──────────────────────────
let globalChatInitialized = false

// ─── 内部工具：直接通过 store.peerConnection 发送 DataChannel 消息 ──────────
// 不依赖 useWebRTC()，避免每次 useChat() 都额外注册一套信令 eventBus 监听器

/**
 * 向 DataChannel 发送一条消息。
 * - 推流端：等待 dataChannelReady（由 useWebRTC 内部维护），未就绪时暂存到 pendingMessages
 * - 观看端：等待 channel open，最多等 5s
 * 返回 true / false / Promise<boolean>，语义与 useWebRTC.sendDataChannelMessage 一致。
 *
 * 注意：推流端的 dataChannelReady 标志位存在于 useWebRTC 实例内部（ref），
 * 无法从外部直接读取。这里采用保守策略：
 *   - 推流端：channel open 且 readyState === 'open' 即可发送
 *     （datachannel-ready 握手由 useWebRTC 内部处理，pendingMessages 也在那里）
 *   - 观看端：同上
 * 实际上 useWebRTC 已经在 channel.onmessage 里处理了 datachannel-ready 并 flush
 * pendingMessages，所以这里只需要判断 readyState 即可。
 */
function sendViaDataChannel(data: unknown): boolean | Promise<boolean> {
  const store = useWebRTCStore()
  const pc = store.peerConnection
  if (!pc) return false

  const channel = pc.dataChannel
  const msgStr = JSON.stringify(data)

  if (!channel) {
    // channel 还没建立（观看端等待 ondatachannel 触发）
    return new Promise<boolean>(resolve => {
      let resolved = false
      const checkInterval = setInterval(() => {
        const ch = pc.dataChannel
        if (ch && ch.readyState === 'open') {
          clearInterval(checkInterval)
          if (!resolved) {
            resolved = true
            try { ch.send(msgStr); resolve(true) } catch { resolve(false) }
          }
        }
      }, 100)
      setTimeout(() => {
        clearInterval(checkInterval)
        if (!resolved) { resolved = true; resolve(false) }
      }, 5000)
    })
  }

  if (channel.readyState === 'open') {
    try { channel.send(msgStr); return true } catch { return false }
  }

  if (channel.readyState === 'connecting') {
    return new Promise<boolean>(resolve => {
      const onOpen = () => {
        channel.removeEventListener('open', onOpen)
        try { channel.send(msgStr); resolve(true) } catch { resolve(false) }
      }
      channel.addEventListener('open', onOpen)
      setTimeout(() => { channel.removeEventListener('open', onOpen); resolve(false) }, 5000)
    })
  }

  return false
}

// ─── useChat composable ───────────────────────────────────────────────────────

export function useChat() {
  const store = useWebRTCStore()

  // ── 状态（全部来自 store，所有实例共享同一份数据）────────────────────────
  const messages = computed(() => store.chatMessages)
  const newMessage = computed({
    get: () => store.chatNewMessage,
    set: (v: string) => store.setChatNewMessage(v)
  })

  // ── 消息接收 ─────────────────────────────────────────────────────────────

  const onDataChannelMessage = (data: ChatMessage): void => {
    if (data.type !== 'chat') return

    store.addChatMessage({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      text: escapeHtml(data.text || ''),
      sender: data.sender === store.clientId ? '我' : (data.sender || '对方'),
      timestamp: data.timestamp || Date.now(),
      isLocal: false
    })
  }

  // ── 发送消息 ──────────────────────────────────────────────────────────────

  const sendMessage = (text: string): boolean => {
    if (!text.trim() || store.chatIsSending) return false
    store.setChatIsSending(true)

    const chatMsg: ChatMessage = {
      type: 'chat',
      text: text.trim(),
      sender: store.clientId || '我',
      timestamp: Date.now()
    }

    // 乐观更新：先显示在 UI 里，发送失败时回滚
    const optimisticId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
    store.addChatMessage({
      id: optimisticId,
      text: escapeHtml(chatMsg.text),
      sender: '我',
      timestamp: chatMsg.timestamp,
      isLocal: true
    })

    const rollback = () => store.removeChatMessage(optimisticId)

    const sent = sendViaDataChannel(chatMsg)

    if (sent === true) {
      store.setChatNewMessage('')
      store.setChatIsSending(false)
      return true
    }

    if (sent === false) {
      // DataChannel 未就绪，500ms 后重试一次
      setTimeout(() => {
        const retrySent = sendViaDataChannel(chatMsg)
        if (retrySent === true) {
          store.setChatNewMessage('')
        } else if (retrySent === false) {
          // 重试也失败，回滚乐观更新
          rollback()
        } else {
          // Promise 分支
          ;(retrySent as Promise<boolean>).then(ok => {
            if (ok) store.setChatNewMessage('')
            else rollback()
          }).finally(() => store.setChatIsSending(false))
          return
        }
        store.setChatIsSending(false)
      }, 500)
      return false
    }

    // Promise<boolean> 分支（观看端 channel 还在 connecting）
    ;(sent as Promise<boolean>).then(ok => {
      if (ok) store.setChatNewMessage('')
      else rollback()
    }).finally(() => store.setChatIsSending(false))
    return false
  }

  // ── 已读标记 ──────────────────────────────────────────────────────────────

  const markAsRead = (): void => {
    localStorage.setItem('chat_last_read', Date.now().toString())
  }

  // ── 初始化 / 清理 ─────────────────────────────────────────────────────────

  let saveTimer: ReturnType<typeof setInterval> | null = null
  let initialized = false

  /**
   * 注册 DataChannel 消息监听器，启动定期持久化。
   * 幂等：多次调用只生效一次。
   * 全局防护：防止多个 useChat 实例重复注册监听器。
   */
  const init = (): void => {
    if (initialized) return
    initialized = true

    // 全局防护：只有第一个 useChat 实例才注册监听器
    if (!globalChatInitialized) {
      globalChatInitialized = true
      eventBus.on('data-channel-message', onDataChannelMessage)
    }

    if (saveTimer) clearInterval(saveTimer)
    saveTimer = setInterval(() => {
      if (store.chatMessages.length > 0 && store.roomId) {
        localStorage.setItem(
          `chat_history_${store.roomId}`,
          JSON.stringify(store.chatMessages)
        )
      }
    }, 30_000)
  }

  /** 清理监听器和定时器（由 onUnmounted 自动调用） */
  const cleanup = (): void => {
    if (initialized) {
      eventBus.off('data-channel-message', onDataChannelMessage)
      globalChatInitialized = false
    }
    if (saveTimer) {
      clearInterval(saveTimer)
      saveTimer = null
    }
    initialized = false
  }

  onUnmounted(cleanup)

  return {
    messages,
    newMessage,
    sendMessage,
    markAsRead,
    init,
    cleanup
  }
}
