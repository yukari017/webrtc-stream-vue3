<template>
  <div class="mobile-layout">
    <header class="mobile-header">
      <h2>{{ tabTitles[activeTab] }}</h2>
      <div class="header-actions">
        <router-link to="/viewer" class="switch-btn" title="切换到观看端">
          <i class="fas fa-eye"></i>
          <span class="switch-text">观看</span>
        </router-link>
        <div class="status-indicator" :class="connectionStatusClass">
          <span class="status-dot"></span>
          {{ connectionStatusText }}
        </div>
      </div>
    </header>
    
    <main class="mobile-content">
      <KeepAlive>
        <MobileStreamTab
          v-if="activeTab === 'stream'"
          v-model:roomId="roomId"
          :selected-camera-id="selectedCameraId"
        />
        <MobileSettingsTab
          v-else-if="activeTab === 'settings'"
          v-model:selectedCameraId="selectedCameraId"
          v-model:selectedAudioDeviceId="selectedAudioDeviceId"
          v-model:settings="settings"
          :cameras="cameras"
          :audio-devices="audioDevices"
          @refresh-devices="initDevices"
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
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useWebRTCStore } from '@/stores'
import { useWebRTC } from '@/composables/useWebRTC'
import { useMediaStream } from '@/composables/useMediaStream'
import { generateRoomId } from '@/utils/ui-utils'
import type { WebRTCSettings, AudioDevice } from '@/types/webrtc'
import MobileTabBar from './MobileTabBar.vue'
import MobileStreamTab from './MobileStreamTab.vue'
import MobileSettingsTab from './MobileSettingsTab.vue'
import MobileChatTab from './MobileChatTab.vue'
import MobileLogTab from './MobileLogTab.vue'

type TabId = 'stream' | 'settings' | 'chat' | 'log'

const store = useWebRTCStore()
const webrtc = useWebRTC()
const media = useMediaStream()

const activeTab = ref<TabId>('stream')

const roomId = ref('')
const selectedCameraId = ref('')
const selectedAudioDeviceId = ref('')
const chatUnreadCount = ref(0)

const cameras = ref<MediaDeviceInfo[]>([])
const audioDevices = ref<AudioDevice[]>([])

const settings = ref<WebRTCSettings>({
  frameRate: 60,
  resolution: '1440p',
  quality: 'ultra',
  shareAudio: true,
  shareCursor: true
})

const tabTitles: Record<TabId, string> = {
  stream: '推流',
  settings: '设置',
  chat: '聊天',
  log: '日志'
}

const isConnected = computed(() => store.isConnected)

const connectionStatusClass = computed(() => {
  if (store.isStreaming) return 'online'
  if (store.isConnected) return 'connecting'
  return 'offline'
})

const connectionStatusText = computed(() => {
  if (store.isStreaming) return '推流中'
  if (store.isConnected) return '已连接'
  return '未连接'
})

const handleUnreadCountUpdate = (count: number) => {
  chatUnreadCount.value = count
}

const initDevices = async () => {
  try {
    const devices = await media.refreshAudioDevices(true)
    audioDevices.value = devices
    
    if (devices.length > 0) {
      const firstRealDevice = devices.find(d => d.label)
      if (firstRealDevice) {
        selectedAudioDeviceId.value = firstRealDevice.deviceId
      }
    }
  } catch (error) {
    console.error('刷新音频设备失败:', error)
  }
  
  try {
    let tempStream: MediaStream | null = null
    
    try {
      tempStream = await navigator.mediaDevices.getUserMedia({ video: true })
    } catch {
      // 权限被拒也能继续
    }
    
    const devices = await navigator.mediaDevices.enumerateDevices()
    cameras.value = devices.filter(d => d.kind === 'videoinput')
    
    if (cameras.value.length > 0 && !selectedCameraId.value) {
      const rearCamera = cameras.value.find(c => {
        const label = (c.label || '').toLowerCase()
        return label.includes('back') || label.includes('rear') || 
               label.includes('后置') || label.includes('environment')
      })
      selectedCameraId.value = rearCamera 
        ? rearCamera.deviceId 
        : cameras.value[cameras.value.length - 1].deviceId
    }
    
    if (tempStream) {
      tempStream.getTracks().forEach(t => t.stop())
    }
  } catch (error) {
    console.error('加载摄像头列表失败:', error)
  }
}

watch(settings, (newSettings) => {
  store.updateSettings(newSettings)
}, { deep: true })

watch(selectedAudioDeviceId, (newDeviceId) => {
  store.setSelectedAudioDevice(newDeviceId)
})

const isPageReload = () => {
  try {
    const navigationEntries = window.performance.getEntriesByType('navigation')
    return navigationEntries.length > 0 && (navigationEntries[0] as PerformanceNavigationTiming).type === 'reload'
  } catch {
    return false
  }
}

const handlePageShow = (event: PageTransitionEvent) => {
  if (event.persisted && store.isStreaming) {
    store.updateStatus('检测到页面恢复，清理状态...', 'info')
    webrtc.stopStreaming()
  }
}

onMounted(async () => {
  window.addEventListener('pageshow', handlePageShow)

  const savedRoomId = sessionStorage.getItem('streamerRoomId')
  if (isPageReload() && savedRoomId) {
    store.updateStatus('检测到页面刷新，清理状态...', 'info')
    sessionStorage.removeItem('streamerRoomId')
    store.cleanup()
  }

  roomId.value = generateRoomId()
  if (roomId.value) {
    sessionStorage.setItem('streamerRoomId', roomId.value)
  }

  await initDevices()
})

onUnmounted(() => {
  window.removeEventListener('pageshow', handlePageShow)
  webrtc.stopStreaming()
  media.stopAllStreams()
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
  background: linear-gradient(135deg, #7dd3fc 0%, #bae6fd 100%);
  color: #0f172a;
  text-decoration: none;
  transition: all 0.2s ease;
  font-size: 0.75rem;
  font-weight: 500;
}

.switch-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(125, 211, 252, 0.4);
}

body.dark-theme .switch-btn {
  background: linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%);
  color: white;
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
