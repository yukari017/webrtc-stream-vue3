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
          @update:unread-count="handleUnreadCountUpdate"
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
import { useChat } from '@/composables/useChat'
import MobileTabBar from '@/components/mobile/MobileTabBar.vue'
import MobileChatTab from '@/components/mobile/MobileChatTab.vue'
import MobileLogTab from '@/components/mobile/MobileLogTab.vue'
import ViewerMobileStreamTab from './ViewerMobileStreamTab.vue'
import ViewerMobileSettingsTab from './ViewerMobileSettingsTab.vue'

type TabId = 'stream' | 'settings' | 'chat' | 'log'

const store = useWebRTCStore()
const webrtc = useWebRTC()
const chat = useChat()

const activeTab = ref<TabId>('stream')
const roomId = ref('')
const chatUnreadCount = ref(0)
const autoReconnect = ref(true)
const volume = ref(100)

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

const handleUnreadCountUpdate = (count: number) => {
  chatUnreadCount.value = count
}

const handleVolumeUpdate = (vol: number) => {
  volume.value = vol
}

onMounted(() => {
  chat.init()
})

onUnmounted(() => {
  webrtc.stopStreaming()
  store.cleanup()
})
</script>

<style scoped>
.mobile-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f5f5;
  overflow: hidden;
}

body.dark-theme .mobile-layout {
  background: #1a1a1a;
}

.mobile-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  background: linear-gradient(135deg, #fb7299 0%, #fc8bab 100%);
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 1rem;
  z-index: 1000;
  box-shadow: 0 2px 10px rgba(251, 114, 153, 0.3);
}

body.dark-theme .mobile-header {
  background: linear-gradient(135deg, #fb7299 0%, #fc8bab 100%);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
}

.mobile-header h2 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: white;
}

body.dark-theme .mobile-header h2 {
  color: white;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.switch-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: 16px;
  background: linear-gradient(135deg, #fb7299 0%, #fc8bab 100%);
  color: white;
  text-decoration: none;
  transition: all 0.2s ease;
  font-size: 0.75rem;
  font-weight: 500;
}

.switch-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(251, 114, 153, 0.4);
}

body.dark-theme .switch-btn {
  background: linear-gradient(135deg, #fb7299 0%, #fc8bab 100%);
}

.switch-btn i {
  font-size: 0.75rem;
}

.switch-text {
  white-space: nowrap;
}

.status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-indicator.online {
  background: #c6f6d5;
  color: #22543d;
}

body.dark-theme .status-indicator.online {
  background: #22543d;
  color: #c6f6d5;
}

.status-indicator.offline {
  background: #fed7d7;
  color: #742a2a;
}

body.dark-theme .status-indicator.offline {
  background: #742a2a;
  color: #fed7d7;
}

.status-indicator.connecting {
  background: #feebc8;
  color: #744210;
}

body.dark-theme .status-indicator.connecting {
  background: #744210;
  color: #feebc8;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.mobile-content {
  margin-top: 56px;
  margin-bottom: 56px;
  flex: 1;
  overflow: hidden;
  position: relative;
}

body.dark-theme .mobile-content {
  background: #1a1a1a;
}
</style>
