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
      
      <RoomConnection
        :model-value="roomId"
        @update:model-value="$emit('update:roomId', $event)"
        input-id="mobile-room-id"
        input-name="roomId"
        placeholder="输入房间号或点击生成"
        :readonly="true"
        :disabled="isStreaming"
        :show-generate="true"
        :show-copy="true"
        :generate-disabled="isStreaming"
        :copy-disabled="!roomId"
        @generate="generateRoomIdHandler"
        @copy="copyRoomId"
        class="mt-4"
      />
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
import RoomConnection from '@/components/common/RoomConnection.vue'

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

/* 卡片、视频容器、按钮样式已在全局 mobile-common.css 和 components.css 中定义 */

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

.stream-controls {
  display: flex;
  gap: 0.375rem;
  margin-top: 0.5rem;
}

.flex-1 {
  flex: 1;
}

.fa-3x {
  font-size: 2em;
}
</style>
