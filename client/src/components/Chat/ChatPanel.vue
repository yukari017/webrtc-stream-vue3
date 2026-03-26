<template>
  <div class="card chat-panel">
    <div class="card-header">
      <h3 class="card-title">
        <i class="fas fa-comments"></i>
        实时聊天
      </h3>
      <span class="badge" v-if="unreadCount > 0">{{ unreadCount }}</span>
    </div>
    
    <div class="chat-container">
      <div 
        class="chat-messages" 
        ref="chatMessagesRef"
        @click="markMessagesAsRead"
      >
        <div 
          v-for="(message, index) in messages" 
          :key="message.id || index" 
          class="chat-message"
          :class="{ 'own-message': message.isLocal }"
        >
          <div class="message-avatar">
            <i class="fas" :class="message.isLocal ? 'fa-user' : 'fa-user'"></i>
          </div>
          <div class="message-body">
            <div class="message-header">
              <span class="message-sender">{{ message.sender }}</span>
              <span class="message-time">{{ formatTime(message.timestamp) }}</span>
            </div>
            <div class="message-content">{{ message.text }}</div>
          </div>
        </div>
        <div v-if="messages.length === 0" class="chat-empty">
          <i class="fas fa-comments fa-2x mb-2"></i>
          <p>暂无聊天消息，开始第一场对话吧！</p>
        </div>
      </div>
      
      <div class="chat-input">
        <label for="chat-message-input" class="sr-only">聊天消息</label>
        <input 
          id="chat-message-input"
          name="chatMessage"
          type="text" 
          class="form-control" 
          v-model="chat.newMessage.value" 
          :placeholder="isConnected ? '输入消息，按 Enter 发送...' : '未连接'"
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useChat } from '@/composables/useChat'

// 接收 isConnected 属性
const props = defineProps({
  isConnected: {
    type: Boolean,
    default: false
  }
})

const chat = useChat()
const chatMessagesRef = ref<HTMLDivElement | null>(null)

// 使用 computed 来访问响应式数据
const messages = computed(() => chat.messages.value)
const unreadCount = ref(0)
const previousMessageCount = ref(0)

// 监听新消息
watch(() => messages.value.length, (newLength) => {
  if (newLength > previousMessageCount.value) {
    // 有新消息
    const newMessage = messages.value[messages.value.length - 1]
    
    // 如果是收到的消息（非本地发送），增加未读计数
    if (newMessage && !newMessage.isLocal) {
      unreadCount.value++
    }
    
    // 自动滚动到底部（无论是发送还是接收消息）
    nextTick(() => {
      if (chatMessagesRef.value) {
        chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight
      }
    })
  }
  previousMessageCount.value = newLength
})

// 发送消息
const sendMessage = () => {
  if (!chat.newMessage.value.trim() || !props.isConnected) return
  
  chat.sendMessage(chat.newMessage.value)
  unreadCount.value = 0
  
  // 发送消息后也滚动到底部
  setTimeout(() => {
    if (chatMessagesRef.value) {
      chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight
    }
  }, 100)
}

// 标记消息为已读
const markMessagesAsRead = () => {
  unreadCount.value = 0
  chat.markAsRead()
}

// 格式化时间
const formatTime = (timestamp: string | number): string => {
  if (!timestamp) return ''
  
  try {
    const date = typeof timestamp === 'string' 
      ? new Date(Date.parse(timestamp))
      : new Date(timestamp)
    
    if (isNaN(date.getTime())) {
      return ''
    }
    
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

// 初始化
onMounted(() => {
  const unsubscribe = chat.init()
  
  // 保存取消订阅函数，在组件卸载时调用
  onUnmounted(() => {
    if (unsubscribe) unsubscribe()
  })
})
</script>

<style scoped>
/* 屏幕阅读器专用样式 */
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

.chat-panel {
  margin-top: 1rem;
}

.chat-container {
  display: flex;
  flex-direction: column;
  height: 400px;
  border-radius: 6px;
  overflow: hidden;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  background: #f8f9fa;
  cursor: pointer;
}

body.dark-theme .chat-messages {
  background: #2d3748;
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
  font-size: 0.9rem;
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
  margin-bottom: 0.35rem;
  gap: 1rem;
}

.own-message .message-header {
  flex-direction: row-reverse;
}

.message-sender {
  font-weight: 600;
  font-size: 0.875rem;
  color: #2d3748;
}

body.dark-theme .message-sender {
  color: #e2e8f0;
}

.own-message .message-sender {
  color: #fb7299;
}

.message-time {
  font-size: 0.75rem;
  color: #a0aec0;
  font-weight: 500;
}

.message-content {
  display: inline-block;
  padding: 0.75rem 1rem;
  background: white;
  border-radius: 12px;
  border-top-left-radius: 4px;
  word-wrap: break-word;
  line-height: 1.5;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  max-width: 70%;
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
}

body.dark-theme .chat-input .form-control {
  background: #2d3748;
  border-color: #4a5568;
  color: #e2e8f0;
}

.chat-input .form-control:focus {
  outline: none;
  border-color: #fb7299;
  box-shadow: 0 0 0 3px rgba(251, 114, 153, 0.15);
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

.send-btn:hover {
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

.badge {
  background: linear-gradient(135deg, #fb7299 0%, #fc8bab 100%);
  color: white;
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-weight: 600;
}
</style>
