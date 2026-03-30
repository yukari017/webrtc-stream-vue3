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
        v-model="newMessage"
        :placeholder="isConnected ? '输入消息...' : '未连接'"
        @keyup.enter="sendMessage"
        :disabled="!isConnected"
      />
      <button
        class="btn btn-primary send-btn"
        @click="sendMessage"
        :disabled="!isConnected || !newMessage.trim()"
        title="发送消息"
      >
        <i class="fas fa-paper-plane"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onActivated, nextTick } from 'vue'
import { useWebRTCStore } from '@/stores'

const props = defineProps<{
  isConnected: boolean
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

const store = useWebRTCStore()
const chatMessagesRef = ref<HTMLDivElement | null>(null)

// 直接读写 store，与 ChatPanel 共享同一份状态
const newMessage = computed({
  get: () => store.chatNewMessage,
  set: (v: string) => store.setChatNewMessage(v)
})

// 收到新消息时自动滚动到底部
watch(() => props.messages.length, () => {
  nextTick(() => {
    if (chatMessagesRef.value) {
      chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight
    }
  })
})

const sendMessage = () => {
  const text = store.chatNewMessage.trim()
  if (!text || !props.isConnected) return

  emit('send-message', text)
  emit('mark-read')

  nextTick(() => {
    if (chatMessagesRef.value) {
      chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight
    }
  })
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
/* 移动端聊天特有样式 - 公共样式见 components.css */

.mobile-chat-tab {
  position: fixed;
  top: 56px;
  left: 0;
  right: 0;
  bottom: 56px;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
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

/* 系统消息 */
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

.chat-empty .text-muted {
  font-size: 0.75rem;
  margin-top: 0.25rem;
}

.chat-input {
  background: var(--bg-primary);
  border-top: 1px solid var(--border-color);
}

.chat-input .form-control {
  background: var(--bg-primary);
  border-color: var(--border-color);
  color: var(--text-primary);
}

.chat-input .form-control::placeholder {
  color: var(--text-muted);
}
</style>
