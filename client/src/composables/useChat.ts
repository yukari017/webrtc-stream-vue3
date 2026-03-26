import { ref, onUnmounted } from 'vue'
import { useWebRTCStore } from '@/stores'
import type { ChatMessage } from '@/types/webrtc'
import { useWebRTC } from '@/composables/useWebRTC'
import { escapeHtml } from '@/utils/ui-utils'

interface LocalChatMessage {
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
  
  // 监听数据通道消息
  const setupMessageListener = (): (() => void) => {
    const callback = (data: unknown): void => {
      if ((data as ChatMessage).type === 'chat') {
        addMessage({
          text: (data as ChatMessage).text,
          sender: (data as ChatMessage).sender === '我' ? '对方' : ((data as ChatMessage).sender || '对方'),
          isLocal: false
        })
      }
    }
    
    webrtc.on('data-channel-message', callback)
    
    return () => {
      webrtc.off('data-channel-message', callback)
    }
  }
  
  // 添加消息
  const addMessage = (message: Partial<LocalChatMessage>): void => {
    const safeMessage: LocalChatMessage = {
      id: message.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: escapeHtml(message.text || ''),
      sender: message.sender || '未知',
      timestamp: message.timestamp || Date.now(),
      isLocal: message.isLocal,
      isSystem: message.isSystem
    }
    
    messages.value.push(safeMessage)
    
    if (messages.value.length > 100) {
      messages.value = messages.value.slice(-100)
    }
  }
  
  // 发送消息
  const sendMessage = (text: string): boolean => {
    if (!text.trim() || isSending.value) return false
    
    isSending.value = true
    
    try {
      const message: ChatMessage = {
        type: 'chat',
        text: text.trim(),
        sender: '我',
        timestamp: Date.now()
      }
      
      addMessage({
        ...message,
        isLocal: true
      })
      
      const sent = webrtc.sendDataChannelMessage(message)
      
      if (sent) {
        newMessage.value = ''
        return true
      } else {
        setTimeout(() => {
          const retrySent = webrtc.sendDataChannelMessage(message)
          if (retrySent) {
            newMessage.value = ''
          }
        }, 500)
        return false
      }
    } catch (error) {
      console.error('发送消息失败:', error)
      store.updateStatus('发送消息失败', 'error')
      return false
    } finally {
      isSending.value = false
    }
  }

  // 标记已读
  const markAsRead = (): void => {
    localStorage.setItem('chat_last_read', Date.now().toString())
  }
  
  // 初始化
  const init = (): (() => void) => {
    messages.value = []
    
    const unsubscribe = setupMessageListener()
    
    const saveInterval = setInterval(() => {
      if (messages.value.length > 0 && store.roomId) {
        localStorage.setItem(`chat_history_${store.roomId}`, JSON.stringify(messages.value))
      }
    }, 30000)
    
    return () => {
      clearInterval(saveInterval)
      if (unsubscribe) unsubscribe()
    }
  }
  
  onUnmounted(() => {
    messages.value = []
  })
  
  return {
    sendMessage,
    markAsRead,
    messages,
    newMessage,
    isSending,
    init
  }
}
