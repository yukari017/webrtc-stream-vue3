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
      
      <RoomConnection
        :model-value="roomId"
        @update:model-value="$emit('update:roomId', $event)"
        input-id="viewer-room-id"
        input-name="roomId"
        placeholder="输入推流端的房间号"
        :disabled="isConnected"
        :show-clear="true"
        :show-join="true"
        :show-connection-info="true"
        :show-leave="true"
        :join-disabled="!roomId || isConnected"
        :join-text="isConnected ? '已加入' : '加入'"
        :is-connected="isConnected"
        @clear="clearRoomId"
        @submit="joinRoom"
        @leave="leaveRoom"
        class="mt-4"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, onActivated, onDeactivated, watch, nextTick } from 'vue'
import { useWebRTCStore } from '@/stores'
import { useWebRTC } from '@/composables/useWebRTC'
import { useChat } from '@/composables/useChat'
import MobilePerfPanel from './MobilePerfPanel.vue'
import RoomConnection from '@/components/common/RoomConnection.vue'

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
  const rtt = perfData.value.rtt || 0
  
  // 综合评分：比特率(40%) + 丢包率(30%) + 延迟(30%)
  const bitrateScore = Math.min(100, Math.max(0, (bitrate - 500) / 15))
  const packetLossScore = Math.max(0, 100 - packetLoss * 5)
  const rttScore = Math.max(0, 100 - rtt / 2)
  
  const totalScore = bitrateScore * 0.4 + packetLossScore * 0.3 + rttScore * 0.3
  
  if (totalScore >= 70) return '优秀'
  if (totalScore >= 50) return '良好'
  if (totalScore >= 30) return '一般'
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

const startViewingTimer = (resume = false) => {
  stopViewingTimer(!resume) // 恢复模式下不清空 startTime
  
  // 如果不是恢复，才重置开始时间
  if (!resume || !startTime.value) {
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
  viewTimer = setInterval(updateTimer, 1000)
}

const stopViewingTimer = (clearStartTime = true) => {
  if (viewTimer) {
    clearInterval(viewTimer)
    viewTimer = null
  }
  // 只在真正停止观看时才清空开始时间
  if (clearStartTime) {
    startTime.value = null
    viewingTime.value = '00:00'
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
  // 恢复性能监控和观看计时器（保持之前的计时）
  if (store.isConnected) {
    startPerformanceMonitoring()
    startViewingTimer(true) // 恢复模式
  }
})

// KeepAlive 停用时暂停性能监控和计时器（但不断开连接，保留开始时间）
onDeactivated(() => {
  stopPerformanceMonitoring()
  stopViewingTimer(false) // 保留 startTime，回来时继续
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

/* 卡片、视频容器、按钮样式已在全局 mobile-common.css 和 components.css 中定义 */

.fa-3x {
  font-size: 2em;
}
</style>
