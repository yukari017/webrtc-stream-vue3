<template>
  <div class="viewer-page">
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
          <div class="card mt-4">
            <div class="card-header">
              <h3 class="card-title">性能监控</h3>
              <button class="btn btn-sm btn-secondary" @click="togglePerfPanel">
                <i class="fas" :class="showPerfPanel ? 'fa-eye-slash' : 'fa-eye'"></i>
                {{ showPerfPanel ? '隐藏' : '显示' }}
              </button>
            </div>
            
            <div class="perf-panel" v-if="showPerfPanel">
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
                <div class="perf-item">
                  <div class="perf-label">缓冲</div>
                  <div class="perf-value">{{ bufferLevel || '0' }}s</div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 房间连接 - 移动端优先显示 -->
          <div class="card room-connection-mobile mt-4">
            <div class="card-header">
              <h3 class="card-title">房间连接</h3>
            </div>
            
            <div class="form-group">
              <label for="viewer-room-id-mobile" class="form-label">房间号</label>
              <div class="input-group">
                <input 
                  id="viewer-room-id-mobile"
                  name="roomIdMobile"
                  type="text" 
                  class="form-control" 
                  v-model="roomId" 
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
                  class="btn btn-success" 
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
              <div class="info-item">
                <i class="fas fa-id-card"></i>
                <span>你的ID: {{ clientId }}</span>
              </div>
            </div>
            
            <div class="connection-controls mt-4">
              <button 
                class="btn btn-danger w-100" 
                @click="leaveRoom" 
                :disabled="!isConnected"
              >
                <i class="fas fa-sign-out-alt"></i>
                离开房间
              </button>
            </div>
          </div>
          
          <!-- 聊天面板 -->
          <ChatPanel :is-connected="isConnected" />
        </div>
        
        <!-- 右侧：控制和状态 -->
        <div class="control-section">
          <!-- 房间连接 - 桌面端显示 -->
          <div class="card room-connection-desktop">
            <div class="card-header">
              <h3 class="card-title">房间连接</h3>
            </div>
            
            <div class="form-group">
              <label for="viewer-room-id-desktop" class="form-label">房间号</label>
              <div class="input-group">
                <input 
                  id="viewer-room-id-desktop"
                  name="roomIdDesktop"
                  type="text" 
                  class="form-control" 
                  v-model="roomId" 
                  placeholder="输入房间号"
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
                  class="btn btn-success" 
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
              <div class="info-item">
                <i class="fas fa-id-card"></i>
                <span>你的ID: {{ clientId }}</span>
              </div>
            </div>
            
            <div class="connection-controls mt-4">
              <button 
                class="btn btn-danger w-100" 
                @click="leaveRoom" 
                :disabled="!isConnected"
              >
                <i class="fas fa-sign-out-alt"></i>
                离开房间
              </button>
            </div>
          </div>
          
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
const showPerfPanel = ref(true)
const autoReconnect = ref(true)
const volume = ref(100)

// 计时器
const startTime = ref<number | null>(null)
const viewingTime = ref('00:00')

// 性能监控定时器
let performanceTimer: ReturnType<typeof setInterval> | null = null
let prevBytesReceived = 0
let prevTimestamp = 0

// 更新性能监控数据
const updatePerformanceStats = async () => {
  if (!store.peerConnection || !store.remoteStream) return
  
  try {
    const stats = await store.peerConnection.getStats()
    let bitrate = 0
    let framerate = 0
    let packetLoss = 0
    let rtt = 0
    
    stats.forEach(report => {
      // 获取视频接收统计
      if (report.type === 'inbound-rtp' && report.kind === 'video') {
        // 计算比特率（使用字节差和时间差）
        if (report.bytesReceived && report.timestamp) {
          const bytesDelta = report.bytesReceived - prevBytesReceived
          const timeDelta = (report.timestamp - prevTimestamp) / 1000 // 转换为秒
          
          if (timeDelta > 0 && bytesDelta > 0) {
            bitrate = Math.round((bytesDelta * 8) / timeDelta / 1000) // kbps
          }
          
          // 保存当前值用于下次计算
          prevBytesReceived = report.bytesReceived
          prevTimestamp = report.timestamp
        }
        
        // 获取帧率
        if (report.framesPerSecond) {
          framerate = report.framesPerSecond
        }
        
        // 获取丢包数
        if (report.packetsLost !== undefined) {
          packetLoss = report.packetsLost
        }
      }
      
      // 获取 RTT（往返延迟）
      if (report.type === 'candidate-pair' && report.nominated && report.currentRoundTripTime) {
        rtt = Math.round(report.currentRoundTripTime * 1000)
      }
    })
    
    // 获取视频分辨率
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

// 启动性能监控定时器
const startPerformanceMonitoring = () => {
  if (performanceTimer) clearInterval(performanceTimer)
  // 重置比特率计算初始值
  prevBytesReceived = 0
  prevTimestamp = 0
  performanceTimer = setInterval(updatePerformanceStats, 1000)
}

// 停止性能监控
const stopPerformanceMonitoring = () => {
  if (performanceTimer) {
    clearInterval(performanceTimer)
    performanceTimer = null
  }
}

// 连接关闭处理
const handleConnectionClosed = () => {
  store.updateStatus('推流端已停止推流', 'warning')
  
  // 停止观看
  stopViewingTimer()
  stopPerformanceMonitoring()
  
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
const perfData = computed(() => store.performance)
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
  const bitrate = perfData.value.bitrate || 0
  const packetLoss = perfData.value.packetLoss || 0
  
  if (bitrate > 2000 && packetLoss < 5) return '优秀'
  if (bitrate > 1000 && packetLoss < 10) return '良好'
  if (bitrate > 500 && packetLoss < 20) return '一般'
  return '较差'
})

const bufferLevel = computed((): string => {
  if (!remoteVideo.value) return '0'
  const buffered = remoteVideo.value.buffered
  return buffered.length > 0 
    ? (buffered.end(0) - buffered.start(0)).toFixed(1)
    : '0'
})

// 方法
const joinRoom = async () => {
  if (!roomId.value) return
  
  const success = await webrtc.joinAsViewer(roomId.value)
  if (success) {
    // 保存房间号到 localStorage，持久化缓存
    localStorage.setItem('viewerRoomId', roomId.value)
    
    startTime.value = Date.now()
    startViewingTimer()
    chat.init()
    // 启动性能监控
    startPerformanceMonitoring()
  }
}

const leaveRoom = () => {
  // 停止观看
  webrtc.stopStreaming()
  stopViewingTimer()
  stopPerformanceMonitoring()
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

const togglePerfPanel = () => {
  showPerfPanel.value = !showPerfPanel.value
}

const updateVolume = () => {
  if (remoteVideo.value) {
    remoteVideo.value.volume = volume.value / 100
  }
}

const startViewingTimer = (): (() => void) => {
  const updateTimer = () => {
    if (!startTime.value) return
    
    const elapsed = Date.now() - startTime.value
    const minutes = Math.floor(elapsed / 60000)
    const seconds = Math.floor((elapsed % 60000) / 1000)
    
    viewingTime.value = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  
  updateTimer()
  const timer = setInterval(updateTimer, 1000)
  
  return () => clearInterval(timer)
}

const stopViewingTimer = () => {
  startTime.value = null
  viewingTime.value = '00:00'
}

// 监听远程流变化
watch(remoteStream, async (newStream) => {
  // 等待 DOM 更新
  await nextTick()
  
  if (newStream && remoteVideo.value) {
    const video = remoteVideo.value
    // 确保视频元素的属性正确设置
    video.autoplay = true
    ;(video as HTMLVideoElement & { playsInline: boolean }).playsInline = true
    video.controls = true
    
    // 默认开启声音
    video.muted = false
    isMuted.value = false
    
    // 先清空之前的 srcObject
    if (video.srcObject) {
      video.srcObject = null
    }
    
    // 等待一小段时间再设置新的 srcObject
    await new Promise(resolve => setTimeout(resolve, 50))
    
    // 设置视频流
    video.srcObject = newStream
    
    // 强制触发视频元素重新加载
    video.load()
    
    // 等待视频元数据加载
    await new Promise(resolve => setTimeout(resolve, 200))
    
    // 尝试播放视频
    if (video.paused) {
      video.play().catch((err: Error) => {
        console.error('视频播放失败:', err)
      })
    }
    
    // 添加错误监听
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
        startPerformanceMonitoring()
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

.placeholder-content {
  text-align: center;
}

.stream-info {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1rem;
}

body.dark-theme .stream-info {
  background: #4a5568;
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
  color: #495057;
}

body.dark-theme .info-item {
  color: #cbd5e0;
}

.info-item i {
  color: #fb7299;
}

.perf-panel {
  padding: 0.375rem 0.5rem;
  background: #f8f9fa;
  border-radius: 4px;
}

body.dark-theme .perf-panel {
  background: #4a5568;
}

.perf-grid {
  display: flex;
  justify-content: space-around;
  gap: 0.25rem;
}

.perf-item {
  text-align: center;
  padding: 0.125rem 0.25rem;
  min-width: 0;
  flex: 1;
}

.perf-label {
  font-size: 0.625rem;
  color: #6c757d;
  margin-bottom: 0;
  white-space: nowrap;
}

body.dark-theme .perf-label {
  color: #a0aec0;
}

.perf-value {
  font-size: 0.75rem;
  font-weight: 600;
  color: #2d3748;
  white-space: nowrap;
}

body.dark-theme .perf-value {
  color: #e2e8f0;
}

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

.control-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
  padding: 1.5rem;
}

body.dark-theme .card {
  background: #2d3748;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #eaeaea;
}

body.dark-theme .card-header {
  border-bottom: 1px solid #4a5568;
}

.card-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #2d3748;
}

body.dark-theme .card-title {
  color: #e2e8f0;
}

.badge {
  background: #dc3545;
  color: white;
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  min-width: 1.5rem;
  text-align: center;
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
  padding: 1rem;
  margin-top: 1rem;
}

body.dark-theme .connection-info {
  background: #4a5568;
}

.playback-controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.checkbox-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.slider-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.volume-slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: #e9ecef;
  outline: none;
  -webkit-appearance: none;
}

body.dark-theme .volume-slider {
  background: #4a5568;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: linear-gradient(135deg, #7dd3fc 0%, #bae6fd 100%);
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(125, 211, 252, 0.4);
}

.volume-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: linear-gradient(135deg, #7dd3fc 0%, #bae6fd 100%);
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 6px rgba(125, 211, 252, 0.4);
}

.slider-value {
  text-align: right;
  font-size: 0.875rem;
  color: #6c757d;
}

body.dark-theme .slider-value {
  color: #a0aec0;
}

.status-log {
  max-height: 200px;
  overflow-y: auto;
  padding: 0.5rem;
  background: #f8f9fa;
  border-radius: 6px;
  font-family: monospace;
  font-size: 0.875rem;
}

body.dark-theme .status-log {
  background: #4a5568;
  color: #e2e8f0;
}

.log-entry {
  padding: 0.25rem 0;
  border-bottom: 1px solid #eee;
  display: flex;
  align-items: center;
}

body.dark-theme .log-entry {
  border-bottom: 1px solid #718096;
}

.log-time {
  color: #6c757d;
  margin-right: 0.5rem;
  font-size: 0.75rem;
  min-width: 8ch;
}

body.dark-theme .log-time {
  color: #a0aec0;
}

.log-message {
  flex: 1;
}

.log-info {
  color: #007bff;
}

.log-warning {
  color: #ffc107;
}

.log-error {
  color: #dc3545;
}

.log-success {
  color: #28a745;
}

.log-empty {
  text-align: center;
  color: #6c757d;
  padding: 1rem;
  font-style: italic;
}

body.dark-theme .log-empty {
  color: #a0aec0;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0069d9;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #5a6268;
}

/* bilibili 粉色主题按钮 */
.btn-success {
  background: linear-gradient(135deg, #fb7299 0%, #fc8bab 100%);
  color: white;
  border: none;
  box-shadow: 0 2px 8px rgba(251, 114, 153, 0.3);
  font-weight: 500;
}

.btn-success:hover:not(:disabled) {
  background: linear-gradient(135deg, #fc8bab 0%, #fda4c6 100%);
  box-shadow: 0 4px 12px rgba(251, 114, 153, 0.4);
  transform: translateY(-1px);
}

/* 淡蓝色 - 用于次要操作 */
.btn-secondary {
  background: linear-gradient(135deg, #7dd3fc 0%, #bae6fd 100%);
  color: #0c4a6e;
  border: none;
  box-shadow: 0 2px 8px rgba(125, 211, 252, 0.3);
  font-weight: 500;
}

.btn-secondary:hover:not(:disabled) {
  background: linear-gradient(135deg, #bae6fd 0%, #e0f2fe 100%);
  box-shadow: 0 4px 12px rgba(125, 211, 252, 0.4);
  transform: translateY(-1px);
}

/* 淡绿色 - 用于状态指示 */
.btn-info {
  background: linear-gradient(135deg, #86efac 0%, #bbf7d0 100%);
  color: #14532d;
  border: none;
  box-shadow: 0 2px 8px rgba(134, 239, 172, 0.3);
  font-weight: 500;
}

.btn-info:hover:not(:disabled) {
  background: linear-gradient(135deg, #bbf7d0 0%, #dcfce7 100%);
  box-shadow: 0 4px 12px rgba(134, 239, 172, 0.4);
  transform: translateY(-1px);
}

/* 淡粉色 - 用于危险/停止操作 */
.btn-danger {
  background: linear-gradient(135deg, #fda4af 0%, #fecdd3 100%);
  color: #9f1239;
  border: none;
  box-shadow: 0 2px 8px rgba(253, 164, 175, 0.3);
  font-weight: 500;
}

.btn-danger:hover:not(:disabled) {
  background: linear-gradient(135deg, #fecdd3 0%, #ffe4e6 100%);
  box-shadow: 0 4px 12px rgba(253, 164, 175, 0.4);
  transform: translateY(-1px);
}

.form-group {
  margin-bottom: 1rem;
}

.form-label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #495057;
}

body.dark-theme .form-label {
  color: #cbd5e0;
}

.form-control {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 0.875rem;
  background: #fff;
  color: #2d3748;
}

body.dark-theme .form-control {
  background: #4a5568;
  border-color: #718096;
  color: #e2e8f0;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  padding: 0.25rem 0.5rem;
  border-radius: 20px;
}

/* 状态指示器颜色 - 使用淡色系 */
.status-indicator.online .status-dot {
  background: #86efac;
  box-shadow: 0 0 8px rgba(134, 239, 172, 0.6);
}

.status-indicator.connecting .status-dot {
  background: #7dd3fc;
  box-shadow: 0 0 8px rgba(125, 211, 252, 0.6);
}

.status-indicator.offline .status-dot {
  background: #fda4af;
  box-shadow: 0 0 8px rgba(253, 164, 175, 0.6);
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.w-100 {
  width: 100%;
}

.mt-2 {
  margin-top: 0.5rem;
}

.mt-4 {
  margin-top: 1rem;
}

.mb-2 {
  margin-bottom: 0.5rem;
}

.mb-4 {
  margin-bottom: 1rem;
}

.text-sm {
  font-size: 0.875rem;
}

.text-muted {
  color: #6c757d;
}

body.dark-theme .text-muted {
  color: #a0aec0;
}

.fa-4x {
  font-size: 4em;
}

.fa-3x {
  font-size: 3em;
}

.fa-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>