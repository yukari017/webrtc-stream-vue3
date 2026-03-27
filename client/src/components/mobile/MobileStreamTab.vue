<template>
  <div class="mobile-stream-tab">
    <div class="video-section">
      <div class="card">
        <div class="video-container" v-if="localStream || store.screenStream">
          <video ref="localVideo" autoplay controls muted></video>
          <div class="video-overlay" v-if="!isStreaming">
            <i class="fas fa-play-circle fa-3x mb-2"></i>
            <p>点击下方按钮开始推流</p>
          </div>
          <div v-if="isStreaming" class="stream-time">
            <i class="fas fa-clock"></i>
            {{ streamingTime }}
          </div>
        </div>
        
        <div class="video-placeholder" v-else>
          <div class="placeholder-content">
            <i class="fas fa-video-slash fa-3x mb-2"></i>
            <p>未检测到视频流</p>
            <p class="text-sm text-muted">请先点击下方按钮获取摄像头视频流</p>
          </div>
        </div>
        
        <div class="stream-controls">
          <button class="btn btn-primary flex-1" @click="getCameraStream" :disabled="isGettingStream || isStreaming">
            <i class="fas fa-camera"></i>
            {{ isGettingStream ? '获取中...' : '摄像头' }}
          </button>
          <button
            class="btn btn-success flex-1"
            @click="startStreaming"
            :disabled="!roomId || (!localStream && !store.screenStream) || isStreaming"
          >
            <i class="fas fa-play"></i>
            开始推流
          </button>
          <button
            class="btn btn-danger flex-1"
            @click="stopAll"
            :disabled="!localStream && !store.screenStream && !isStreaming"
          >
            <i class="fas fa-stop"></i>
            停止
          </button>
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
          <label for="mobile-room-id" class="form-label">房间号</label>
          <div class="input-group">
            <input
              id="mobile-room-id"
              name="roomId"
              type="text"
              class="form-control"
              :value="roomId"
              @input="$emit('update:roomId', ($event.target as HTMLInputElement).value.toUpperCase())"
              placeholder="输入房间号或点击生成"
              readonly
              :disabled="isStreaming"
            />
            <button
              class="btn btn-secondary"
              @click="generateRoomIdHandler"
              title="生成新房间号"
              :disabled="isStreaming"
            >
              <i class="fas fa-random"></i>
              生成
            </button>
            <button
              class="btn btn-primary"
              @click="copyRoomId"
              title="复制房间号"
              :disabled="!roomId"
            >
              <i class="fas fa-copy"></i>
              复制
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, onActivated, onDeactivated, watch } from 'vue'
import { useWebRTCStore } from '@/stores'
import { useWebRTC } from '@/composables/useWebRTC'
import { useMediaStream } from '@/composables/useMediaStream'
import { generateRoomId } from '@/utils/ui-utils'
import MobilePerfPanel from './MobilePerfPanel.vue'

const props = defineProps<{
  roomId: string
  selectedCameraId?: string
}>()

const emit = defineEmits<{
  'update:roomId': [value: string]
}>()

const store = useWebRTCStore()
const webrtc = useWebRTC()
const media = useMediaStream()

const localVideo = ref<HTMLVideoElement | null>(null)
const showPerfPanel = ref(true)
const isGettingStream = ref(false)
const currentStreamType = ref('')
const streamingTime = ref('00:00')

let performanceTimer: ReturnType<typeof setInterval> | null = null
let streamTimer: ReturnType<typeof setInterval> | null = null
let streamStartTime: number | null = null
let prevBytesSent = 0
let prevTimestamp = 0

const isStreaming = computed(() => store.isStreaming)
const localStream = computed(() => store.localStream)
const perfData = computed(() => store.performance)

const generateRoomIdHandler = () => {
  const newRoomId = generateRoomId()
  emit('update:roomId', newRoomId)
  if (document.hasFocus()) {
    copyRoomId()
  }
}

const copyRoomId = async () => {
  if (!props.roomId) return
  try {
    await navigator.clipboard.writeText(props.roomId)
    store.updateStatus('房间号已复制到剪贴板', 'success')
  } catch {
    // 静默失败
  }
}

const getCameraStream = async () => {
  isGettingStream.value = true
  try {
    const constraints: MediaStreamConstraints = props.selectedCameraId
      ? { video: { deviceId: { exact: props.selectedCameraId } } }
      : {}
    const stream = await media.getCameraStream(constraints)
    if (stream) {
      currentStreamType.value = 'camera'
      if (localVideo.value) {
        localVideo.value.srcObject = stream
        localVideo.value.play().catch(() => {})
      }
    }
  } catch (error) {
    console.error('获取摄像头失败:', error)
    store.updateStatus('获取摄像头失败，请检查权限设置', 'error')
  } finally {
    isGettingStream.value = false
  }
}

const startStreaming = async () => {
  if (!props.roomId || (!store.localStream && !store.screenStream)) {
    store.updateStatus('无法开始推流：房间号或视频流为空', 'error')
    return
  }

  try {
    sessionStorage.setItem('streamerRoomId', props.roomId)
    const type = store.screenStream ? 'screen' : 'camera'
    const success = await webrtc.startStreaming(props.roomId, type)
    if (success) {
      store.updateStatus('推流已开始', 'success')
      startPerformanceMonitoring()
      startStreamingTimer()
    }
  } catch (error) {
    const err = error as Error
    store.updateStatus(`推流开始失败: ${err.message}`, 'error')
  }
}

const stopAll = () => {
  stopPerformanceMonitoring()
  stopStreamingTimer()

  if (store.isStreaming) {
    webrtc.stopStreaming()
  }

  media.stopAllStreams()

  if (localVideo.value) {
    localVideo.value.srcObject = null
  }

  store.cleanup()
  currentStreamType.value = ''
  sessionStorage.removeItem('streamerRoomId')

  if (store.isStreaming) {
    generateRoomIdHandler()
  }
}

const togglePerfPanel = () => {
  showPerfPanel.value = !showPerfPanel.value
}

const updatePerformanceStats = async () => {
  if (!store.peerConnection) return
  
  try {
    const stats = await store.peerConnection.getStats()
    let bitrate = 0
    let framerate = 0
    let rtt = 0
    
    stats.forEach(report => {
      if (report.type === 'outbound-rtp' && report.kind === 'video') {
        if (report.bytesSent && report.timestamp) {
          const bytesDelta = report.bytesSent - prevBytesSent
          const timeDelta = (report.timestamp - prevTimestamp) / 1000
          
          if (timeDelta > 0 && bytesDelta > 0) {
            bitrate = Math.round((bytesDelta * 8) / timeDelta / 1000)
          }
          
          prevBytesSent = report.bytesSent
          prevTimestamp = report.timestamp
        }
        
        if (report.framesPerSecond) {
          framerate = report.framesPerSecond
        }
      }
      
      if (report.type === 'candidate-pair' && report.nominated && report.currentRoundTripTime) {
        rtt = Math.round(report.currentRoundTripTime * 1000)
      }
    })
    
    const currentStream = store.screenStream || store.localStream
    let resolution = '0×0'
    if (currentStream) {
      const videoTrack = currentStream.getVideoTracks()[0]
      if (videoTrack) {
        const settings = videoTrack.getSettings()
        if (settings.width && settings.height) {
          resolution = `${settings.width}×${settings.height}`
        }
      }
    }
    
    store.updatePerformance({
      bitrate: bitrate || 0,
      framerate: framerate || 0,
      resolution,
      packetLoss: 0,
      rtt: rtt || 0
    })
  } catch (error) {
    console.error('获取推流端性能统计失败:', error)
  }
}

const startPerformanceMonitoring = () => {
  if (performanceTimer) clearInterval(performanceTimer)
  prevBytesSent = 0
  prevTimestamp = 0
  performanceTimer = setInterval(updatePerformanceStats, 1000)
}

const stopPerformanceMonitoring = () => {
  if (performanceTimer) {
    clearInterval(performanceTimer)
    performanceTimer = null
  }
}

const startStreamingTimer = () => {
  streamStartTime = Date.now()
  streamingTime.value = '00:00'

  const updateTimer = () => {
    if (!streamStartTime) return
    const elapsed = Date.now() - streamStartTime
    const minutes = Math.floor(elapsed / 60000)
    const seconds = Math.floor((elapsed % 60000) / 1000)
    streamingTime.value = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  updateTimer()
  streamTimer = setInterval(updateTimer, 1000)
}

const stopStreamingTimer = () => {
  if (streamTimer) {
    clearInterval(streamTimer)
    streamTimer = null
  }
  streamStartTime = null
  streamingTime.value = '00:00'
}

watch(localStream, (newStream) => {
  if (newStream && localVideo.value) {
    localVideo.value.srcObject = newStream
    localVideo.value.play().catch(() => {})
  }
})

onMounted(() => {
  if (localStream.value && localVideo.value) {
    localVideo.value.srcObject = localStream.value
  }
})

onUnmounted(() => {
  stopPerformanceMonitoring()
  stopStreamingTimer()
})

// KeepAlive 激活时恢复视频流
onActivated(() => {
  if (localStream.value && localVideo.value) {
    localVideo.value.srcObject = localStream.value
    localVideo.value.play().catch(() => {})
  }
  // 恢复性能监控和计时器
  if (store.isStreaming) {
    startPerformanceMonitoring()
    startStreamingTimer()
  }
})

// KeepAlive 停用时暂停监控和计时器（但不断开连接）
onDeactivated(() => {
  stopPerformanceMonitoring()
  stopStreamingTimer()
})
</script>

<style scoped>
.mobile-stream-tab {
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

.mobile-stream-tab::-webkit-scrollbar {
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

.video-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 1rem;
  text-align: center;
}

.stream-time {
  position: absolute;
  bottom: 8px;
  left: 8px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
}

.stream-time i {
  font-size: 0.625rem;
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

.stream-controls {
  display: flex;
  gap: 0.375rem;
  margin-top: 0.5rem;
}

.flex-1 {
  flex: 1;
}

.btn {
  padding: 0.625rem 0.75rem;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  user-select: none;
  position: relative;
  z-index: 10;
  font-size: 0.875rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  transition: all 0.2s;
  font-weight: 500;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-sm {
  padding: 0.375rem 0.5rem;
  font-size: 0.75rem;
}

.btn-primary {
  background: #fb7299;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(251, 114, 153, 0.4);
}

.btn-secondary {
  background: #60a5fa;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(96, 165, 250, 0.4);
}

.btn-success {
  background: #fb7299;
  color: white;
}

.btn-success:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(251, 114, 153, 0.4);
}

.btn-danger {
  background: #fb7299;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(251, 114, 153, 0.4);
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
