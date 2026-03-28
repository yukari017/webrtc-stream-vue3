import { ref, onUnmounted } from 'vue'
import { useWebRTCStore } from '@/stores'
import { eventBus } from '@/utils/eventBus'
import type { ChatMessage } from '@/types/webrtc'
import { useWebRTC } from '@/composables/useWebRTC'
import { escapeHtml } from '@/utils/ui-utils'

export interface LocalChatMessage {
  id: string
  text: string
  sender: string
  timestamp: number
  isLocal?: boolean
  isSystem?: boolean
}

export function useChat() {
  const store = useWebRTCStore()
  const webrtc = useWebRTC()

  const messages = ref<LocalChatMessage[]>([])
  const newMessage = ref('')
  const isSending = ref(false)

  // ─── Data Channel 消息监听 ─────────────────────────────────────────────

  const onDataChannelMessage = (data: unknown): void => {
    const msg = data as ChatMessage
    if (msg.type === 'chat') {
      addMessage({
        text: msg.text,
        sender: msg.sender === store.clientId ? '我' : msg.sender,
        timestamp: msg.timestamp || Date.now(),
        isLocal: false
      })
    }
  }

  const setupMessageListener = (): void => {
    eventBus.on('data-channel-message', onDataChannelMessage)
  }

  // ─── 消息操作 ─────────────────────────────────────────────────────────

  const addMessage = (message: Partial<LocalChatMessage>): void => {
    messages.value.push({
      id: message.id || `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      text: escapeHtml(message.text || ''),
      sender: message.isLocal ? '我' : (message.sender || '未知'),
      timestamp: message.timestamp || Date.now(),
      isLocal: message.isLocal,
      isSystem: message.isSystem
    })

    // 超过 100 条时丢弃最旧的
    if (messages.value.length > 100) {
      messages.value = messages.value.slice(-100)
    }
  }

  const sendMessage = (text: string): boolean => {
    if (!text.trim() || isSending.value) return false

    isSending.value = true

    const chatMsg: ChatMessage = {
      type: 'chat',
      text: text.trim(),
      sender: store.clientId || '我',
      timestamp: Date.now()
    }

    addMessage({ ...chatMsg, isLocal: true })

    const sent = webrtc.sendDataChannelMessage(chatMsg)

    if (sent === true) {
      newMessage.value = ''
      isSending.value = false
      return true
    }

    // 异步发送，500ms 后重试一次
    if (sent === false) {
      setTimeout(() => {
        const retrySent = webrtc.sendDataChannelMessage(chatMsg)
        if (retrySent) {
          newMessage.value = ''
        }
      }, 500)
    } else {
      // Promise<boolean> case
      ;(sent as Promise<boolean>).finally(() => {
        isSending.value = false
      })
      return false
    }

    isSending.value = false
    return false
  }

  // ─── 已读标记 ─────────────────────────────────────────────────────────

  const markAsRead = (): void => {
    localStorage.setItem('chat_last_read', Date.now().toString())
  }

  // ─── 初始化 ───────────────────────────────────────────────────────────

  let saveTimer: ReturnType<typeof setInterval> | null = null

  const init = (): (() => void) => {
    messages.value = []
    setupMessageListener()

    saveTimer = setInterval(() => {
      if (messages.value.length > 0 && store.roomId) {
        localStorage.setItem(
          `chat_history_${store.roomId}`,
          JSON.stringify(messages.value)
        )
      }
    }, 30_000)

    return () => {
      if (saveTimer) clearInterval(saveTimer)
      eventBus.off('data-channel-message', onDataChannelMessage)
    }
  }

  onUnmounted(() => {
    messages.value = []
  })

  return {
    sendMessage,
    markAsRead,
    init,
    messages,
    newMessage,
    isSending
  }
}
