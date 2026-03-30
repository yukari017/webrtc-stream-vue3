<template>
  <!-- 移动端：使用 Tab 布局 -->
  <ViewerMobileLayout v-if="isMobileDevice" />
  
  <!-- 桌面端：保持原有布局 -->
  <div class="viewer-page" v-else>
    <div class="page-header">
      <h2><i class="fas fa-eye"></i> 观看端</h2>
      <p class="subtitle">观看推流端的实时视频流</p>
    </div>
    
    <div class="page-content">
      <div class="grid-layout">
        <!-- 左侧：视频播放 -->
        <div class="video-section">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">远程视频流</h3>
              <div class="status-indicator" :class="connectionStatusClass">
                <span class="status-dot"></span>
                {{ connectionStatusText }}
              </div>
            </div>
            
            <div class="video-container" v-if="remoteStream">
              <video ref="remoteVideo" autoplay controls playsinline width="100%" height="100%" style="object-fit: contain;"></video>
            </div>
            
            <div class="video-placeholder" v-else>
              <div class="placeholder-content">
                <i class="fas fa-video-slash fa-4x mb-4"></i>
                <p v-if="isConnected">等待推流端连接...</p>
                <p v-else>未连接到房间</p>
                <p class="text-sm text-muted">请输入房间号并加入观看</p>
              </div>
            </div>
            
            <div class="stream-info mt-4" v-if="remoteStream">
              <div class="info-grid">
                <div class="info-item">
                  <i class="fas fa-signal"></i>
                  <span>连接质量: {{ connectionQuality }}</span>
                </div>
                <div class="info-item">
                  <i class="fas fa-clock"></i>
                  <span>观看时长: {{ viewingTime }}</span>
                </div>
                <div class="info-item">
                  <i class="fas fa-user"></i>
                  <span>推流端: {{ streamerId || '未知' }}</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 性能监控面板 -->
          <PerfPanel mode="receive" :show-buffer="true" :active="isConnected" />
          
          <!-- 房间连接 - 移动端优先显示 -->
          <RoomConnection
            v-model="roomId"
            input-id="viewer-room-id-mobile"
            input-name="roomIdMobile"
            placeholder="输入推流端的房间号"
            :disabled="isConnected"
            :show-clear="true"
            :show-join="true"
            :show-connection-info="true"
            :show-leave="true"
            :join-disabled="!roomId || isConnected"
            :join-text="isConnected ? '已加入' : '加入'"
            :is-connected="isConnected"
            :client-id="clientId"
            @clear="clearRoomId"
            @submit="joinRoom"
            @leave="leaveRoom"
            class="room-connection-mobile mt-4"
          />
          
          <!-- 聊天面板 -->
          <ChatPanel :is-connected="isConnected" />
        </div>
        
        <!-- 右侧：控制和状态 -->
        <div class="control-section">
          <!-- 房间连接 - 桌面端显示 -->
          <RoomConnection
            v-model="roomId"
            input-id="viewer-room-id-desktop"
            input-name="roomIdDesktop"
            placeholder="输入房间号"
            :disabled="isConnected"
            :show-clear="true"
            :show-join="true"
            :show-connection-info="true"
            :show-leave="true"
            :join-disabled="!roomId || isConnected"
            :join-text="isConnected ? '已加入' : '加入'"
            :is-connected="isConnected"
            :client-id="clientId"
            @clear="clearRoomId"
            @submit="joinRoom"
            @leave="leaveRoom"
            class="room-connection-desktop"
          />
          
          <!-- 播放控制 -->
          <div class="card mt-4">
            <div class="card-header">
              <h3 class="card-title">播放控制</h3>
            </div>
            
            <div class="playback-controls">
              <div class="checkbox-group">
                <input 
                  type="checkbox" 
                  id="autoReconnect" 
                  v-model="autoReconnect"
                />
                <label for="autoReconnect">自动重连</label>
              </div>
              
              <div class="slider-group mt-4">
                <label for="viewer-volume" class="form-label">音量</label>
                <input 
                  id="viewer-volume"
                  name="volume"
                  type="range" 
                  min="0" 
                  max="100" 
                  v-model="volume" 
                  class="volume-slider"
                  @input="updateVolume"
                />
                <div class="slider-value">{{ volume }}%</div>
              </div>
            </div>
          </div>
          
          <!-- 状态日志 -->
          <StatusLog />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useWebRTCStore } from '@/stores'
import { useWebRTC } from '@/composables/useWebRTC'
import { useChat } from '@/composables/useChat'
import ChatPanel from '@/components/Chat/ChatPanel.vue'
import StatusLog from '@/components/common/StatusLog.vue'
import RoomConnection from '@/components/common/RoomConnection.vue'
import ViewerMobileLayout from '@/components/mobile/ViewerMobileLayout.vue'
import PerfPanel from '@/components/common/PerfPanel.vue'
import { isMobile } from '@/utils/ui-utils'

const isMobileDevice = isMobile()

const store = useWebRTCStore()
const webrtc = useWebRTC()
const chat = useChat()

// 状态
const remoteVideo = ref<HTMLVideoElement | null>(null)
const _roomId = ref('')
const roomId = computed({
  get: () => _roomId.value,
  set: (val: string) => { _roomId.value = val.toUpperCase() }
})
const isMuted = ref(false)
const autoReconnect = ref(true)
const volume = ref(100)

// 计时器
const startTime = ref<number | null>(null)
const viewingTime = ref('00:00')
let viewingTimer: ReturnType<typeof setInterval> | null = null

// 连接关闭处理
const handleConnectionClosed = () => {
  store.updateStatus('推流端已停止推流', 'warning')
  
  // 停止观看
  stopViewingTimer()
  
  // 清理视频元素
  if (remoteVideo.value) {
    remoteVideo.value.srcObject = null
  }
  
  // 清理所有资源
  store.cleanup()
  
  // 清除保存的房间号
  sessionStorage.removeItem('viewerRoomId')
  
  // 重置房间号
  roomId.value = ''
  
  store.updateStatus('已自动离开房间', 'info')
}

// 检测是否是页面刷新
const isPageReload = () => {
  try {
    const navigationEntries = window.performance.getEntriesByType('navigation')
    return navigationEntries.length > 0 && (navigationEntries[0] as PerformanceNavigationTiming).type === 'reload'
  } catch {
    return false
  }
}

// 计算属性
const isConnected = computed(() => store.isConnected)
const remoteStream = computed(() => store.remoteStream)
const clientId = computed(() => store.clientId)
const streamerId = computed(() => store.roomId ? store.roomId.split('-')[0] : '')

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

const connectionQuality = computed(() => {
  const bitrate = store.performance.bitrate || 0
  const packetLoss = store.performance.packetLoss || 0
  const rtt = store.performance.rtt || 0
  
  // 综合评分：比特率(40%) + 丢包率(30%) + 延迟(30%)
  // 比特率评分：0-500(0分), 500-2000(50分), 2000+(100分)
  const bitrateScore = Math.min(100, Math.max(0, (bitrate - 500) / 15))
  // 丢包率评分：0%(100分), 20%(0分)
  const packetLossScore = Math.max(0, 100 - packetLoss * 5)
  // 延迟评分：0ms(100分), 200ms(0分)
  const rttScore = Math.max(0, 100 - rtt / 2)
  
  const totalScore = bitrateScore * 0.4 + packetLossScore * 0.3 + rttScore * 0.3
  
  if (totalScore >= 70) return '优秀'
  if (totalScore >= 50) return '良好'
  if (totalScore >= 30) return '一般'
  return '较差'
})

// 方法
const joinRoom = async () => {
  if (!roomId.value) return
  
  const success = await webrtc.joinAsViewer(roomId.value)
  if (success) {
    // 保存房间号，持久化缓存（用 localStorage 跨 tab/重启保留）
    localStorage.setItem('viewerRoomId', roomId.value)
    sessionStorage.setItem('viewerRoomId', roomId.value) // pageshow 重连用
    
    startTime.value = Date.now()
    startViewingTimer()
    chat.init()
  }
}

const leaveRoom = () => {
  // 停止观看
  webrtc.stopStreaming()
  stopViewingTimer()
  chat.markAsRead()
  
  // 清理本地状态
  if (remoteVideo.value) {
    remoteVideo.value.srcObject = null
  }
  
  // 清理所有资源
  store.cleanup()
  
  // 保留缓存的房间号（用户下次可以直接用）
  // 重置房间号
  roomId.value = ''
  
  store.updateStatus('已离开房间', 'info')
}

const clearRoomId = () => {
  roomId.value = ''
  localStorage.removeItem('viewerRoomId')
}

const updateVolume = () => {
  if (remoteVideo.value) {
    remoteVideo.value.volume = volume.value / 100
  }
}

const startViewingTimer = () => {
  stopViewingTimer() // 先清理之前的计时器
  
  if (!startTime.value) {
    startTime.value = Date.now()
  }
  
  const updateTimer = () => {
    if (!startTime.value) return
    
    const elapsed = Date.now() - startTime.value
    const minutes = Math.floor(elapsed / 60000)
    const seconds = Math.floor((elapsed % 60000) / 1000)
    
    viewingTime.value = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  
  updateTimer()
  viewingTimer = setInterval(updateTimer, 1000)
}

const stopViewingTimer = (clearStartTime = true) => {
  if (viewingTimer) {
    clearInterval(viewingTimer)
    viewingTimer = null
  }
  if (clearStartTime) {
    startTime.value = null
    viewingTime.value = '00:00'
  }
}

// 监听远程流变化
watch(remoteStream, async (newStream) => {
  await nextTick()
  
  if (newStream && remoteVideo.value) {
    const video = remoteVideo.value
    video.autoplay = true
    ;(video as HTMLVideoElement & { playsInline: boolean }).playsInline = true
    video.controls = true
    video.muted = false
    isMuted.value = false
    
    // 清空旧流
    if (video.srcObject) {
      video.srcObject = null
    }
    
    video.srcObject = newStream
    
    // 等 loadedmetadata 再 play，比 setTimeout 更可靠
    await new Promise<void>(resolve => {
      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        resolve()
      } else {
        video.addEventListener('loadedmetadata', () => resolve(), { once: true })
      }
    })
    
    if (video.paused) {
      video.play().catch((err: Error) => {
        console.error('视频播放失败:', err)
      })
    }
    
    video.onerror = () => {
      console.error('视频错误:', video.error)
    }
    
    video.onstalled = () => {
      console.warn('视频停滞，无法获取数据')
    }
    
    chat.markAsRead()
  }
})

// pageshow 事件处理 - 兼容 bfcache
const handlePageShow = async (event: PageTransitionEvent) => {
  // event.persisted 表示页面是从 bfcache 恢复的
  if (event.persisted && !store.isConnected && autoReconnect.value) {
    const savedRoomId = sessionStorage.getItem('viewerRoomId')
    
    if (savedRoomId) {
      store.updateStatus('检测到页面恢复，尝试重连...', 'info')
      
      if (!roomId.value) {
        roomId.value = savedRoomId
      }
      
      try {
        await webrtc.joinAsViewer(savedRoomId)
        startTime.value = Date.now()
        startViewingTimer()
        store.updateStatus('重连成功', 'success')
      } catch (error) {
        console.error('重连失败:', error)
        const err = error as Error
        store.updateStatus(`重连失败：${err.message}`, 'error')
      }
    }
  }
}

// 生命周期
onMounted(async () => {
  // 监听事件
  window.addEventListener('pageshow', handlePageShow)

  // 监听连接关闭事件
  webrtc.on('connection-closed', handleConnectionClosed)

  // 初始化聊天
  chat.init()

  // 检测是否是页面刷新
  const savedRoomId = sessionStorage.getItem('viewerRoomId')

  if (isPageReload() && savedRoomId) {
    store.updateStatus('检测到页面刷新，清理状态...', 'info')
    sessionStorage.removeItem('viewerRoomId')
    roomId.value = ''
    store.cleanup()
  }
})

onUnmounted(() => {
  // 清理事件监听
  window.removeEventListener('pageshow', handlePageShow)
  
  // 移除连接关闭事件监听
  webrtc.off('connection-closed', handleConnectionClosed)
  
  // 停止观看
  leaveRoom()
})
</script>

<style scoped>
/* Viewer 页面特有布局样式 - 公共组件样式见 components.css */

.viewer-page {
  min-height: 100vh;
}

.grid-layout {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 2rem;
}

@media (max-width: 1024px) {
  .grid-layout {
    grid-template-columns: 1fr;
  }
}

/* 房间连接响应式显示 */
.room-connection-mobile {
  display: block;
}

.room-connection-desktop {
  display: none;
}

@media (min-width: 1025px) {
  .room-connection-mobile {
    display: none;
  }

  .room-connection-desktop {
    display: block;
  }
}

.video-section {
  display: flex;
  flex-direction: column;
}

.control-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* 流信息 */
.stream-info {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  padding: 1rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.info-item i {
  color: var(--primary);
}

/* 播放控制 */
.playback-controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.slider-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* 性能建议 */
.suggestion-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #856404;
}

body.dark-theme .suggestion-header {
  color: #fed7aa;
}

.suggestion-text {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.5;
}

/* 工具类 */
.w-100 { width: 100%; }
.mt-2 { margin-top: 0.5rem; }
.mt-4 { margin-top: 1rem; }
.mb-2 { margin-bottom: 0.5rem; }
.mb-4 { margin-bottom: 1rem; }
.text-sm { font-size: 0.875rem; }
.text-muted { color: var(--text-muted); }
.fa-4x { font-size: 4em; }
.fa-3x { font-size: 3em; }
.fa-spin { animation: spin 1s linear infinite; }

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>