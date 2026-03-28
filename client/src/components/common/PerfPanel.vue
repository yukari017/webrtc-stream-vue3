<template>
  <div class="card perf-card">
    <div class="card-header">
      <h3 class="card-title">性能监控</h3>
      <button class="btn btn-sm btn-secondary" @click="togglePanel">
        <i class="fas" :class="isVisible ? 'fa-eye-slash' : 'fa-eye'"></i>
        {{ isVisible ? '隐藏' : '显示' }}
      </button>
    </div>

    <div class="perf-panel" v-if="isVisible">
      <div class="perf-grid">
        <div class="perf-item">
          <div class="perf-label">比特率</div>
          <div class="perf-value">{{ perfData.bitrate || '0' }} kbps</div>
        </div>
        <div class="perf-item">
          <div class="perf-label">分辨率</div>
          <div class="perf-value">{{ perfData.resolution || '0×0' }}</div>
        </div>
        <div class="perf-item">
          <div class="perf-label">帧率</div>
          <div class="perf-value">{{ perfData.framerate || '0' }} FPS</div>
        </div>
        <div class="perf-item">
          <div class="perf-label">延迟</div>
          <div class="perf-value">{{ perfData.rtt || '0' }} ms</div>
        </div>
        <div class="perf-item">
          <div class="perf-label">丢包率</div>
          <div class="perf-value">{{ perfData.packetLoss || '0' }}%</div>
        </div>
        <div v-if="showBuffer" class="perf-item">
          <div class="perf-label">缓冲</div>
          <div class="perf-value">{{ bufferLevel || '0' }}s</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useWebRTCStore } from '@/stores'

interface Props {
  mode: 'send' | 'receive'  // send: 推流端, receive: 接收端
  showBuffer?: boolean       // 接收端可显示缓冲
  active?: boolean           // 是否激活监控
}

const props = withDefaults(defineProps<Props>(), {
  showBuffer: false,
  active: false
})

const store = useWebRTCStore()
const isVisible = ref(true)

// 性能监控定时器
let performanceTimer: ReturnType<typeof setInterval> | null = null
let prevBytes = 0  // 推流端用 bytesSent, 接收端用 bytesReceived
let prevTimestamp = 0

// 缓冲级别（仅接收端）
const bufferLevel = ref(0)

// 从 store 获取性能数据
const perfData = computed(() => store.performance)

// 切换面板显示
const togglePanel = () => {
  isVisible.value = !isVisible.value
}

// 更新性能监控数据
const updatePerformanceStats = async () => {
  if (!store.peerConnection) return

  try {
    const stats = await store.peerConnection.getStats()
    let bitrate = 0
    let framerate = 0
    let packetLoss = 0
    let rtt = 0

    stats.forEach(report => {
      if (props.mode === 'receive') {
        // 接收端：使用 inbound-rtp
        if (report.type === 'inbound-rtp' && report.kind === 'video') {
          if (report.bytesReceived && report.timestamp) {
            const bytesDelta = report.bytesReceived - prevBytes
            const timeDelta = (report.timestamp - prevTimestamp) / 1000

            if (timeDelta > 0 && bytesDelta > 0) {
              bitrate = Math.round((bytesDelta * 8) / timeDelta / 1000)
            }

            prevBytes = report.bytesReceived
            prevTimestamp = report.timestamp
          }

          if (report.framesPerSecond) {
            framerate = report.framesPerSecond
          }

          if (report.packetsLost !== undefined) {
            packetLoss = report.packetsLost
          }
        }
      } else {
        // 推流端：使用 outbound-rtp
        if (report.type === 'outbound-rtp' && report.kind === 'video') {
          if (report.bytesSent && report.timestamp) {
            const bytesDelta = report.bytesSent - prevBytes
            const timeDelta = (report.timestamp - prevTimestamp) / 1000

            if (timeDelta > 0 && bytesDelta > 0) {
              bitrate = Math.round((bytesDelta * 8) / timeDelta / 1000)
            }

            prevBytes = report.bytesSent
            prevTimestamp = report.timestamp
          }

          if (report.framesPerSecond) {
            framerate = report.framesPerSecond
          }
        }
      }

      // 获取 RTT（往返延迟）
      if (report.type === 'candidate-pair' && report.nominated && report.currentRoundTripTime) {
        rtt = Math.round(report.currentRoundTripTime * 1000)
      }
    })

    // 获取视频分辨率
    const currentStream = props.mode === 'receive' 
      ? store.remoteStream 
      : (store.screenStream || store.localStream)
    
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

    // 更新 store
    store.updatePerformance({
      bitrate: bitrate || 0,
      framerate: framerate || 0,
      resolution,
      packetLoss: props.mode === 'receive' ? (packetLoss || 0) : 0,
      rtt: rtt || 0
    })
  } catch (error) {
    console.error('获取性能统计失败:', error)
  }
}

// 启动性能监控
const startMonitoring = () => {
  if (performanceTimer) clearInterval(performanceTimer)
  // 重置初始值
  prevBytes = 0
  prevTimestamp = 0
  performanceTimer = setInterval(updatePerformanceStats, 1000)
}

// 停止性能监控
const stopMonitoring = () => {
  if (performanceTimer) {
    clearInterval(performanceTimer)
    performanceTimer = null
  }
}

// 监听 active 状态变化
watch(() => props.active, (active) => {
  if (active) {
    startMonitoring()
  } else {
    stopMonitoring()
  }
}, { immediate: true })

// 组件卸载时清理
onUnmounted(() => {
  stopMonitoring()
})

// 暴露方法供父组件调用
defineExpose({
  startMonitoring,
  stopMonitoring
})
</script>

<style scoped>
.perf-card {
  margin-top: 1rem;
}

.perf-panel {
  padding: 0.5rem 0;
}

.perf-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 0.75rem;
}

.perf-item {
  text-align: center;
  padding: 0.5rem;
  background: var(--bg-secondary, #f8f9fa);
  border-radius: var(--radius-md, 8px);
}

body.dark-theme .perf-item {
  background: #4a5568;
}

.perf-label {
  font-size: 0.75rem;
  color: #6c757d;
  margin-bottom: 0.25rem;
}

body.dark-theme .perf-label {
  color: #a0aec0;
}

.perf-value {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary, #2d3748);
}

body.dark-theme .perf-value {
  color: #e2e8f0;
}
</style>
