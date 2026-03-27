<template>
  <div class="viewer-stream-tab">
    <div class="video-section">
      <div class="card">
        <div class="video-container" v-if="remoteStream">
          <video ref="remoteVideo" autoplay controls playsinline></video>
        </div>
        
        <div class="video-placeholder" v-else>
          <div class="placeholder-content">
            <i class="fas fa-video-slash fa-3x mb-2"></i>
            <p v-if="isConnected">等待推流端连接...</p>
            <p v-else>未连接到房间</p>
            <p class="text-sm text-muted">请输入房间号并加入观看</p>
          </div>
        </div>
        
        <div class="stream-info mt-4" v-if="remoteStream">
          <div class="info-grid">
            <div class="info-item">
              <i class="fas fa-signal"></i>
              <span>{{ connectionQuality }}</span>
            </div>
            <div class="info-item">
              <i class="fas fa-clock"></i>
              <span>{{ viewingTime }}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="card mt-4">
        <div class="card-header">
          <h3 class="card-title">性能监控</h3>
          <button class="btn btn-sm btn-secondary" @click="togglePerfPanel">
            <i class="fas" :class="showPerfPanel ? 'fa-eye-slash' : 'fa-eye'"></i>
            {{ showPerfPanel ? '隐藏' : '显示' }}
          </button>
        </div>
        
        <MobilePerfPanel :show="showPerfPanel" :data="perfData" />
      </div>
      
      <div class="card mt-4">
        <div class="card-header">
          <h3 class="card-title">房间连接</h3>
        </div>
        
        <div class="form-group">
          <label for="viewer-room-id" class="form-label">房间号</label>
          <div class="input-group">
            <input
              id="viewer-room-id"
              name="roomId"
              type="text"
              class="form-control"
              :value="roomId"
              @input="$emit('update:roomId', ($event.target as HTMLInputElement).value.toUpperCase())"
              placeholder="输入推流端的房间号"
              :disabled="isConnected"
              @keyup.enter="joinRoom"
            />
            <button
              class="btn btn-secondary"
              @click="clearRoomId"
              title="清空房间号"
            >
              <i class="fas fa-trash"></i>
              清空
            </button>
            <button
              class="btn btn-danger"
              @click="joinRoom"
              :disabled="!roomId || isConnected"
            >
              <i class="fas fa-sign-in-alt"></i>
              {{ isConnected ? '已加入' : '加入' }}
            </button>
          </div>
        </div>
        
        <div class="connection-info" v-if="isConnected">
          <div class="info-item">
            <i class="fas fa-door-open"></i>
            <span>房间: {{ roomId }}</span>
          </div>
        </div>
        
        <button
          class="btn btn-success w-100 mt-4"
          @click="leaveRoom"
          :disabled="!isConnected"
        >
          <i class="fas fa-sign-out-alt"></i>
          离开房间
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, onActivated, onDeactivated, watch, nextTick } from 'vue'
import { useWebRTCStore } from '@/stores'
import { useWebRTC } from '@/composables/useWebRTC'
import { useChat } from '@/composables/useChat'
import MobilePerfPanel from './MobilePerfPanel.vue'

const props = defineProps<{
  roomId: string
}>()

const emit = defineEmits<{
  'update:roomId': [value: string]
}>()

const store = useWebRTCStore()
const webrtc = useWebRTC()
const chat = useChat()

const remoteVideo = ref<HTMLVideoElement | null>(null)
const showPerfPanel = ref(true)
const startTime = ref<number | null>(null)
const viewingTime = ref('00:00')

let performanceTimer: ReturnType<typeof setInterval> | null = null
let viewTimer: ReturnType<typeof setInterval> | null = null
let prevBytesReceived = 0
let prevTimestamp = 0

const isConnected = computed(() => store.isConnected)
const remoteStream = computed(() => store.remoteStream)
const perfData = computed(() => store.performance)

const connectionQuality = computed(() => {
  const bitrate = perfData.value.bitrate || 0
  const packetLoss = perfData.value.packetLoss || 0
  
  if (bitrate > 2000 && packetLoss < 5) return '优秀'
  if (bitrate > 1000 && packetLoss < 10) return '良好'
  if (bitrate > 500 && packetLoss < 20) return '一般'
  return '较差'
})

const joinRoom = async () => {
  if (!props.roomId) return
  
  const success = await webrtc.joinAsViewer(props.roomId)
  if (success) {
    localStorage.setItem('viewerRoomId', props.roomId)
    startTime.value = Date.now()
    startViewingTimer()
    startPerformanceMonitoring()
    chat.init()
  }
}

const leaveRoom = () => {
  webrtc.stopStreaming()
  stopViewingTimer()
  stopPerformanceMonitoring()
  
  if (remoteVideo.value) {
    remoteVideo.value.srcObject = null
  }
  
  store.cleanup()
  emit('update:roomId', '')
  store.updateStatus('已离开房间', 'info')
}

const clearRoomId = () => {
  emit('update:roomId', '')
  localStorage.removeItem('viewerRoomId')
}

const togglePerfPanel = () => {
  showPerfPanel.value = !showPerfPanel.value
}

const updatePerformanceStats = async () => {
  if (!store.peerConnection || !store.remoteStream) return
  
  try {
    const stats = await store.peerConnection.getStats()
    let bitrate = 0
    let framerate = 0
    let packetLoss = 0
    let rtt = 0
    
    stats.forEach(report => {
      if (report.type === 'inbound-rtp' && report.kind === 'video') {
        if (report.bytesReceived && report.timestamp) {
          const bytesDelta = report.bytesReceived - prevBytesReceived
          const timeDelta = (report.timestamp - prevTimestamp) / 1000
          
          if (timeDelta > 0 && bytesDelta > 0) {
            bitrate = Math.round((bytesDelta * 8) / timeDelta / 1000)
          }
          
          prevBytesReceived = report.bytesReceived
          prevTimestamp = report.timestamp
        }
        
        if (report.framesPerSecond) {
          framerate = report.framesPerSecond
        }
        
        if (report.packetsLost !== undefined) {
          packetLoss = report.packetsLost
        }
      }
      
      if (report.type === 'candidate-pair' && report.nominated && report.currentRoundTripTime) {
        rtt = Math.round(report.currentRoundTripTime * 1000)
      }
    })
    
    const videoTrack = store.remoteStream.getVideoTracks()[0]
    let resolution = '0×0'
    if (videoTrack) {
      const settings = videoTrack.getSettings()
      if (settings.width && settings.height) {
        resolution = `${settings.width}×${settings.height}`
      }
    }
    
    store.updatePerformance({
      bitrate: bitrate || 0,
      framerate: framerate || 0,
      resolution,
      packetLoss: packetLoss || 0,
      rtt: rtt || 0
    })
  } catch (error) {
    console.error('获取性能统计失败:', error)
  }
}

const startPerformanceMonitoring = () => {
  if (performanceTimer) clearInterval(performanceTimer)
  prevBytesReceived = 0
  prevTimestamp = 0
  performanceTimer = setInterval(updatePerformanceStats, 1000)
}

const stopPerformanceMonitoring = () => {
  if (performanceTimer) {
    clearInterval(performanceTimer)
    performanceTimer = null
  }
}

const startViewingTimer = () => {
  const updateTimer = () => {
    if (!startTime.value) return
    
    const elapsed = Date.now() - startTime.value
    const minutes = Math.floor(elapsed / 60000)
    const seconds = Math.floor((elapsed % 60000) / 1000)
    
    viewingTime.value = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  
  updateTimer()
  viewTimer = setInterval(updateTimer, 1000)
}

const stopViewingTimer = () => {
  startTime.value = null
  viewingTime.value = '00:00'
  if (viewTimer) {
    clearInterval(viewTimer)
    viewTimer = null
  }
}

watch(remoteStream, async (newStream) => {
  await nextTick()
  
  if (newStream && remoteVideo.value) {
    const video = remoteVideo.value
    video.autoplay = true
    ;(video as HTMLVideoElement & { playsInline: boolean }).playsInline = true
    video.controls = true
    video.muted = false
    
    if (video.srcObject) {
      video.srcObject = null
    }
    
    await new Promise(resolve => setTimeout(resolve, 50))
    video.srcObject = newStream
    video.load()
    
    await new Promise(resolve => setTimeout(resolve, 200))
    
    if (video.paused) {
      video.play().catch((err: Error) => {
        console.error('视频播放失败:', err)
      })
    }
  }
})

onMounted(() => {
  if (remoteStream.value && remoteVideo.value) {
    remoteVideo.value.srcObject = remoteStream.value
  }
})

onUnmounted(() => {
  stopPerformanceMonitoring()
  stopViewingTimer()
})

// KeepAlive 激活时恢复视频流
onActivated(() => {
  if (remoteStream.value && remoteVideo.value) {
    remoteVideo.value.srcObject = remoteStream.value
    remoteVideo.value.play().catch(() => {})
  }
  // 恢复性能监控和观看计时器
  if (store.isConnected) {
    startPerformanceMonitoring()
    startViewingTimer()
  }
})

// KeepAlive 停用时暂停性能监控和计时器（但不断开连接）
onDeactivated(() => {
  stopPerformanceMonitoring()
  stopViewingTimer()
})
</script>

<style scoped>
.viewer-stream-tab {
  position: fixed;
  top: 56px;
  left: 0;
  right: 0;
  bottom: 56px;
  overflow-y: auto;
  padding: 0.375rem;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.viewer-stream-tab::-webkit-scrollbar {
  display: none;
}

.video-section {
  display: flex;
  flex-direction: column;
}

.card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  padding: 0.5rem;
}

body.dark-theme .card {
  background: #2d3748;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.375rem;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid #eaeaea;
}

body.dark-theme .card-header {
  border-bottom-color: #4a5568;
}

.card-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #2d3748;
}

body.dark-theme .card-title {
  color: #e2e8f0;
}

.video-container {
  position: relative;
  width: 100%;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  aspect-ratio: 16/9;
}

.video-container video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.video-placeholder {
  background: #f8f9fa;
  border-radius: 8px;
  aspect-ratio: 16/9;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6c757d;
}

body.dark-theme .video-placeholder {
  background: #4a5568;
}

.placeholder-content {
  text-align: center;
}

.stream-info {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 0.5rem;
}

body.dark-theme .stream-info {
  background: #4a5568;
}

.info-grid {
  display: flex;
  justify-content: space-around;
  gap: 0.5rem;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: #495057;
}

body.dark-theme .info-item {
  color: #cbd5e0;
}

.info-item i {
  color: #fb7299;
}

.form-group {
  margin-bottom: 0.375rem;
}

.form-label {
  display: block;
  margin-bottom: 0.375rem;
  font-weight: 500;
  font-size: 0.875rem;
  color: #495057;
}

body.dark-theme .form-label {
  color: #cbd5e0;
}

.form-control {
  width: 100%;
  padding: 0.625rem;
  border: 1px solid #ced4da;
  border-radius: 6px;
  font-size: 0.875rem;
  background: #fff;
  color: #2d3748;
}

body.dark-theme .form-control {
  background: #4a5568;
  border-color: #718096;
  color: #e2e8f0;
}

.input-group {
  display: flex;
  gap: 0.5rem;
}

.input-group .form-control {
  flex: 1;
}

.connection-info {
  background: #f8f9fa;
  border-radius: 6px;
  padding: 0.75rem;
  margin-top: 0.75rem;
}

body.dark-theme .connection-info {
  background: #4a5568;
}

.btn {
  padding: 0.625rem 0.75rem;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  transition: all 0.15s ease-out;
  font-weight: 500;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-sm {
  padding: 0.375rem 0.5rem;
  font-size: 0.75rem;
}

.btn-secondary {
  background: #60a5fa;
  color: white;
}

.btn-success {
  background: #fb7299;
  color: white;
}

.btn-danger {
  background: #fb7299;
  color: white;
}

/* 桌面端 hover 效果 */
@media (hover: hover) {
  .btn-secondary:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(96, 165, 250, 0.4);
  }

  .btn-success:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(251, 114, 153, 0.4);
  }

  .btn-danger:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(251, 114, 153, 0.4);
  }
}

/* 移动端 active 点击效果 */
@media (hover: none) {
  .btn-secondary:active:not(:disabled),
  .btn-success:active:not(:disabled),
  .btn-danger:active:not(:disabled) {
    transform: scale(0.96);
    opacity: 0.85;
    transition: none;
  }
}

.w-100 {
  width: 100%;
}

.text-sm {
  font-size: 0.75rem;
}

.text-muted {
  color: #6c757d;
}

body.dark-theme .text-muted {
  color: #a0aec0;
}

.mt-4 {
  margin-top: 0.375rem;
}

.mb-2 {
  margin-bottom: 0.5rem;
}

.fa-3x {
  font-size: 2em;
}
</style>
