<template>
  <div class="mobile-chat-tab">
    <div
      class="chat-messages"
      ref="chatMessagesRef"
      @click="$emit('mark-read')"
    >
      <div
        v-for="(message, index) in messages"
        :key="message.id || index"
        class="chat-message"
        :class="{ 'own-message': message.isLocal, 'system-message': message.isSystem }"
      >
        <template v-if="message.isSystem">
          <div class="system-message-content">
            <i class="fas fa-info-circle"></i>
            <span>{{ message.text }}</span>
          </div>
        </template>
        <template v-else>
          <div class="message-avatar">
            <i class="fas fa-user"></i>
          </div>
          <div class="message-body">
            <div class="message-header">
              <span class="message-sender">{{ message.sender }}</span>
              <span class="message-time">{{ formatTime(message.timestamp) }}</span>
            </div>
            <div class="message-content">{{ message.text }}</div>
          </div>
        </template>
      </div>
      <div v-if="messages.length === 0" class="chat-empty">
        <i class="fas fa-comments fa-2x mb-2"></i>
        <p>暂无聊天消息</p>
        <p class="text-muted">开始第一场对话吧！</p>
      </div>
    </div>

    <div class="chat-input">
      <label for="mobile-chat-input" class="sr-only">聊天消息</label>
      <input
        id="mobile-chat-input"
        name="chatMessage"
        type="text"
        class="form-control"
        v-model="chat.newMessage.value"
        :placeholder="isConnected ? '输入消息...' : '未连接'"
        @keyup.enter="sendMessage"
        :disabled="!isConnected"
      />
      <button
        class="btn btn-primary send-btn"
        @click="sendMessage"
        :disabled="!isConnected || !chat.newMessage.value.trim()"
        title="发送消息"
      >
        <i class="fas fa-paper-plane"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onActivated, nextTick } from 'vue'
import { useChat } from '@/composables/useChat'

const props = defineProps<{
  isConnected: boolean
  /** 由父组件传入的消息列表（父组件统一管理事件监听和未读计数） */
  messages: {
    id: string
    text: string
    sender: string
    timestamp: number
    isLocal?: boolean
    isSystem?: boolean
  }[]
}>()

const emit = defineEmits<{
  'scroll-to-bottom': []
  'mark-read': []
  'send-message': [text: string]
}>()

const chat = useChat()
const chatMessagesRef = ref<HTMLDivElement | null>(null)

// 本地发送消息后滚动到底
watch(() => chat.messages.value.length, () => {
  nextTick(() => {
    if (chatMessagesRef.value) {
      chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight
    }
  })
})

const sendMessage = () => {
  if (!chat.newMessage.value.trim() || !props.isConnected) return

  const text = chat.newMessage.value.trim()
  emit('send-message', text)  // 通知父组件把自己发的消息加到列表
  chat.sendMessage(text)
  emit('mark-read')

  setTimeout(() => {
    if (chatMessagesRef.value) {
      chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight
    }
  }, 100)
}

// 每次激活聊天标签时：滚动到底 + 通知父组件已读
onActivated(() => {
  nextTick(() => {
    if (chatMessagesRef.value) {
      chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight
    }
  })
  emit('scroll-to-bottom')
  emit('mark-read')
})

const formatTime = (timestamp: string | number): string => {
  if (!timestamp) return ''
  try {
    const date = typeof timestamp === 'string'
      ? new Date(Date.parse(timestamp))
      : new Date(timestamp)
    if (isNaN(date.getTime())) return ''
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}
</script>

<style scoped>
.mobile-chat-tab {
  position: fixed;
  top: 56px;
  left: 0;
  right: 0;
  bottom: 56px;
  display: flex;
  flex-direction: column;
  background: #f8f9fa;
}

body.dark-theme .mobile-chat-tab {
  background: #2d3748;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
  cursor: pointer;
}

.chat-message {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
  animation: slideIn 0.3s ease-out;
}

.chat-message.own-message {
  flex-direction: row-reverse;
}

.chat-message.system-message {
  justify-content: center;
  margin: 0.5rem 0;
}

.system-message-content {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.875rem;
  background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e0 100%);
  color: #4a5568;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

body.dark-theme .system-message-content {
  background: linear-gradient(135deg, #4a5568 0%, #2d3748 100%);
  color: #a0aec0;
}

.system-message-content i {
  font-size: 0.75rem;
  color: #718096;
}

body.dark-theme .system-message-content i {
  color: #a0aec0;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-avatar {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #7dd3fc 0%, #bae6fd 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  box-shadow: 0 2px 6px rgba(125, 211, 252, 0.3);
}

.own-message .message-avatar {
  background: linear-gradient(135deg, #fb7299 0%, #fc8bab 100%);
  color: white;
  box-shadow: 0 2px 6px rgba(251, 114, 153, 0.3);
}

.message-body {
  flex: 1;
  min-width: 0;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
  gap: 0.5rem;
}

.own-message .message-header {
  flex-direction: row-reverse;
}

.message-sender {
  font-weight: 600;
  font-size: 0.75rem;
  color: #2d3748;
}

body.dark-theme .message-sender {
  color: #e2e8f0;
}

.own-message .message-sender {
  color: #fb7299;
}

.message-time {
  font-size: 0.625rem;
  color: #a0aec0;
  font-weight: 500;
}

.message-content {
  display: inline-block;
  padding: 0.625rem 0.875rem;
  background: white;
  border-radius: 12px;
  border-top-left-radius: 4px;
  word-wrap: break-word;
  line-height: 1.4;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  max-width: 75%;
  font-size: 0.875rem;
}

body.dark-theme .message-content {
  background: #4a5568;
  color: #e2e8f0;
}

.own-message .message-content {
  background: linear-gradient(135deg, #fb7299 0%, #fc8bab 100%);
  color: white;
  border-top-left-radius: 12px;
  border-top-right-radius: 4px;
  box-shadow: 0 2px 8px rgba(251, 114, 153, 0.3);
}

.own-message .message-body {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.chat-empty {
  text-align: center;
  padding: 2rem 1rem;
  color: #a0aec0;
}

.chat-empty i {
  color: #cbd5e0;
  margin-bottom: 0.5rem;
  opacity: 0.5;
}

.chat-empty p {
  font-size: 0.875rem;
  margin: 0;
  color: #6c757d;
}

.chat-empty .text-muted {
  font-size: 0.75rem;
  margin-top: 0.25rem;
}

body.dark-theme .chat-empty p {
  color: #a0aec0;
}

.chat-input {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem;
  background: #fff;
  border-top: 1px solid #eaeaea;
}

body.dark-theme .chat-input {
  background: #2d3748;
  border-top-color: #4a5568;
}

.chat-input .form-control {
  flex: 1;
  border-radius: 20px;
  padding: 0.5rem 1rem;
  border: 1px solid #e2e8f0;
  font-size: 0.875rem;
}

body.dark-theme .chat-input .form-control {
  background: #4a5568;
  border-color: #718096;
  color: #e2e8f0;
}

.chat-input .form-control:focus {
  outline: none;
  border-color: #fb7299;
  box-shadow: 0 0 0 3px rgba(251, 114, 153, 0.15);
}

.chat-input .form-control::placeholder {
  color: #a0aec0;
}

.send-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
  background: linear-gradient(135deg, #fb7299 0%, #fc8bab 100%);
  border: none;
  color: white;
  transition: all 0.2s ease;
}

.send-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #fc8bab 0%, #fb7299 100%);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(251, 114, 153, 0.4);
}

.send-btn:disabled {
  background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e0 100%);
  color: #a0aec0;
  transform: none;
  box-shadow: none;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: linear-gradient(135deg, #fb7299 0%, #fc8bab 100%);
  color: white;
}
</style>
