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
/* 聊天面板特有样式 - 公共样式见 components.css */

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
  background: var(--bg-secondary);
  cursor: pointer;
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

body.dark-theme .chat-messages {
  background: #2d3748;
}
</style>
