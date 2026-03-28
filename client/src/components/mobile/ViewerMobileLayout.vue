<template>
  <div class="mobile-layout">
    <header class="mobile-header">
      <h2>{{ tabTitles[activeTab] }}</h2>
      <div class="header-actions">
        <router-link to="/" class="switch-btn" title="切换到推流端">
          <i class="fas fa-video"></i>
          <span class="switch-text">推流</span>
        </router-link>
        <div class="status-indicator" :class="connectionStatusClass">
          <span class="status-dot"></span>
          {{ connectionStatusText }}
        </div>
      </div>
    </header>
    
    <main class="mobile-content">
      <KeepAlive>
        <ViewerMobileStreamTab
          v-if="activeTab === 'stream'"
          v-model:roomId="roomId"
          ref="streamTabRef"
        />
        <ViewerMobileSettingsTab
          v-else-if="activeTab === 'settings'"
          v-model:auto-reconnect="autoReconnect"
          v-model:volume="volume"
          @update-volume="handleVolumeUpdate"
        />
        <MobileChatTab
          v-else-if="activeTab === 'chat'"
          :is-connected="isConnected"
          :messages="chatMessages"
          :has-unread="chatUnreadCount > 0"
          @scroll-to-bottom="handleScrollToBottom"
          @mark-read="handleMarkRead"
          @send-message="handleSendMessage"
        />
        <MobileLogTab
          v-else-if="activeTab === 'log'"
        />
      </KeepAlive>
    </main>
    
    <MobileTabBar
      v-model="activeTab"
      :unread-count="chatUnreadCount"
      mode="view"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useWebRTCStore } from '@/stores'
import { useWebRTC } from '@/composables/useWebRTC'
import { eventBus } from '@/utils/eventBus'
import type { ChatMessage } from '@/types/webrtc'
import { escapeHtml } from '@/utils/ui-utils'
import MobileTabBar from '@/components/mobile/MobileTabBar.vue'
import MobileChatTab from '@/components/mobile/MobileChatTab.vue'
import MobileLogTab from '@/components/mobile/MobileLogTab.vue'
import ViewerMobileStreamTab from './ViewerMobileStreamTab.vue'
import ViewerMobileSettingsTab from './ViewerMobileSettingsTab.vue'

type TabId = 'stream' | 'settings' | 'chat' | 'log'

const store = useWebRTCStore()
const webrtc = useWebRTC()

const activeTab = ref<TabId>('stream')
const roomId = ref('')
const chatUnreadCount = ref(0)
const autoReconnect = ref(true)
const volume = ref(100)

/** 聊天消息列表（由父组件统一管理） */
const chatMessages = ref<{
  id: string
  text: string
  sender: string
  timestamp: number
  isLocal?: boolean
  isSystem?: boolean
}[]>([])

const tabTitles: Record<TabId, string> = {
  stream: '观看',
  settings: '设置',
  chat: '聊天',
  log: '日志'
}

const isConnected = computed(() => store.isConnected)
const remoteStream = computed(() => store.remoteStream)

const connectionStatusClass = computed(() => {
  if (remoteStream.value) return 'online'
  if (store.isConnected) return 'connecting'
  return 'offline'
})

const connectionStatusText = computed(() => {
  if (remoteStream.value) return '观看中'
  if (store.isConnected) return '已连接'
  return '未连接'
})

const handleScrollToBottom = () => {
  chatUnreadCount.value = 0
}

const handleMarkRead = () => {
  chatUnreadCount.value = 0
}

const handleVolumeUpdate = (vol: number) => {
  volume.value = vol
}

const handleSendMessage = (text: string): void => {
  chatMessages.value.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    text,
    sender: '我',
    timestamp: Date.now(),
    isLocal: true
  })
}

/** 统一的消息监听（页面加载时就注册，不依赖聊天标签页是否激活） */
const onDataChannelMessage = (data: unknown): void => {
  const msg = data as ChatMessage
  if (msg.type !== 'chat') return

  // 正在聊天标签页时不计数
  if (activeTab.value !== 'chat') {
    chatUnreadCount.value++
  }

  chatMessages.value.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    text: escapeHtml(msg.text || ''),
    sender: msg.sender === store.clientId ? '我' : msg.sender,
    timestamp: msg.timestamp || Date.now(),
    isLocal: false
  })

  // 超过 100 条丢弃最旧的
  if (chatMessages.value.length > 100) {
    chatMessages.value = chatMessages.value.slice(-100)
  }
}

onMounted(() => {
  eventBus.on('data-channel-message', onDataChannelMessage)
})

onUnmounted(() => {
  eventBus.off('data-channel-message', onDataChannelMessage)
  webrtc.stopStreaming()
  store.cleanup()
})
</script>

<style scoped>
/* 移动端观看端布局特有样式 - 公共样式见 mobile-common.css 和 components.css */

/* 切换按钮 - 观看端使用粉色 */
.switch-btn {
  background: linear-gradient(135deg, #fb7299 0%, #fc8bab 100%);
  color: white;
}

.switch-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(251, 114, 153, 0.4);
}
</style>
