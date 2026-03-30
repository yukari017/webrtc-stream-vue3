import { computed, onUnmounted } from 'vue'
import { useWebRTCStore } from '@/stores'
import { eventBus } from '@/utils/eventBus'
import { useWebRTC } from '@/composables/useWebRTC'
import { escapeHtml } from '@/utils/ui-utils'
import type { ChatMessage, LocalChatMessage } from '@/types/webrtc'

export type { LocalChatMessage }

export function useChat() {
  const store = useWebRTCStore()
  const webrtc = useWebRTC()

  // ── 状态（全部来自 store，所有实例共享同一份数据）────────────────────────
  const messages = computed(() => store.chatMessages)
  const newMessage = computed({
    get: () => store.chatNewMessage,
    set: (v: string) => store.setChatNewMessage(v)
  })
  // isSending 不需要跨实例共享，本地 ref 即可
  // 但为了防止多实例竞争，改为 store 里的标志位也可以；
  // 这里保持简单：同一时刻只有一个 ChatPanel 可见，本地 ref 足够
  let isSendingFlag = false

  // ── 消息接收 ─────────────────────────────────────────────────────────────

  const onDataChannelMessage = (data: unknown): void => {
    const msg = data as ChatMessage
    if (msg.type !== 'chat') return

    store.addChatMessage({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      text: escapeHtml(msg.text || ''),
      sender: msg.sender === store.clientId ? '我' : (msg.sender || '对方'),
      timestamp: msg.timestamp || Date.now(),
      isLocal: false
    })
  }

  // ── 发送消息 ──────────────────────────────────────────────────────────────

  const sendMessage = (text: string): boolean => {
    if (!text.trim() || isSendingFlag) return false
    isSendingFlag = true

    const chatMsg: ChatMessage = {
      type: 'chat',
      text: text.trim(),
      sender: store.clientId || '我',
      timestamp: Date.now()
    }

    // 先把自己的消息加到 store（乐观更新）
    store.addChatMessage({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      text: escapeHtml(chatMsg.text),
      sender: '我',
      timestamp: chatMsg.timestamp,
      isLocal: true
    })

    const sent = webrtc.sendDataChannelMessage(chatMsg)

    if (sent === true) {
      store.setChatNewMessage('')
      isSendingFlag = false
      return true
    }

    if (sent === false) {
      // DataChannel 未就绪，500ms 后重试一次
      setTimeout(() => {
        const retrySent = webrtc.sendDataChannelMessage(chatMsg)
        if (retrySent) store.setChatNewMessage('')
        isSendingFlag = false
      }, 500)
      return false
    }

    // Promise<boolean> 分支（观看端 channel 还在 connecting）
    ;(sent as Promise<boolean>).then(ok => {
      if (ok) store.setChatNewMessage('')
    }).finally(() => {
      isSendingFlag = false
    })
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
   * 幂等：多次调用只生效一次（防止 Viewer.vue 里 onMounted + joinRoom 双重调用）。
   */
  const init = (): void => {
    if (initialized) return
    initialized = true

    eventBus.on('data-channel-message', onDataChannelMessage)

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

  /** 清理监听器和定时器（由 onUnmounted 自动调用，无需外部手动调用） */
  const cleanup = (): void => {
    eventBus.off('data-channel-message', onDataChannelMessage)
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
