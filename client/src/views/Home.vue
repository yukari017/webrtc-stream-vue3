<template>
  <div class="home-page">
    <div class="page-header">
      <h2><i class="fas fa-video"></i> 推流端</h2>
      <p class="subtitle" v-if="!isMobileDevice">将您的屏幕或摄像头视频流推送到观看端</p>
      <p class="subtitle" v-else>将您的摄像头视频流推送到观看端</p>
    </div>
    
    <div class="page-content">
      <div class="grid-layout">
        <!-- 左侧：视频预览和控制 -->
        <div class="video-section">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">视频预览</h3>
              <div class="status-indicator" :class="connectionStatusClass">
                <span class="status-dot"></span>
                {{ connectionStatusText }}
              </div>
            </div>
            
            <div class="video-container" v-if="localStream || store.screenStream">
              <video ref="localVideo" autoplay controls muted></video>
              <div class="video-overlay" v-if="!isStreaming">
                <i class="fas fa-play-circle fa-3x mb-4"></i>
                <p>点击下方按钮开始推流</p>
              </div>
            </div>
            
            <div class="video-placeholder" v-else>
              <div class="placeholder-content">
                <i class="fas fa-video-slash fa-4x mb-4"></i>
                <p>未检测到视频流</p>
                <p class="text-sm text-muted" v-if="!isMobileDevice">请先获取屏幕或摄像头视频流</p>
                <p class="text-sm text-muted" v-else>请先点击下方按钮获取摄像头视频流</p>
              </div>
            </div>
            
            <div class="stream-controls mt-4">
              <div class="flex gap-2">
                <!-- 桌面端：显示屏幕共享 + 摄像头 -->
                <template v-if="!isMobileDevice">
                  <button class="btn btn-primary flex-1" @click="getScreenStream" :disabled="isStreaming">
                    <i class="fas fa-desktop"></i>
                    {{ isGettingStream ? '获取中...' : '屏幕共享' }}
                  </button>
                  <button class="btn btn-secondary flex-1" @click="getCameraStream" :disabled="isGettingStream || isStreaming">
                    <i class="fas fa-camera"></i>
                    {{ isGettingStream ? '获取中...' : '摄像头' }}
                  </button>
                </template>
                <!-- 移动端：只显示获取摄像头 -->
                <template v-else>
                  <button class="btn btn-primary flex-1" @click="getCameraStream" :disabled="isGettingStream || isStreaming">
                    <i class="fas fa-camera"></i>
                    {{ isGettingStream ? '获取中...' : '获取摄像头' }}
                  </button>
                </template>
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
              </div>
            </div>
          </div>
          
          <!-- 房间连接 - 移动端优先显示 -->
          <div class="card room-connection-mobile mt-4">
            <div class="card-header">
              <h3 class="card-title">房间连接</h3>
            </div>
            
            <div class="form-group">
              <label for="home-room-id-mobile" class="form-label">房间号</label>
              <div class="input-group">
                <input 
                  id="home-room-id-mobile"
                  name="roomIdMobile"
                  type="text" 
                  class="form-control" 
                  v-model="roomId" 
                  placeholder="输入房间号或点击生成"
                  readonly
                  :disabled="isStreaming"
                />
                <button 
                  class="btn btn-secondary" 
                  @click="generateRoomIdHandler"
                  title="生成新房间号"
                  :disabled="isStreaming"
                  :class="{ 'disabled-btn': isStreaming }"
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
          
          <!-- 聊天面板 -->
          <ChatPanel :is-connected="isConnected" />
        </div>
        
        <!-- 右侧：设置和状态 -->
        <div class="control-section">
          <!-- 房间连接 - 桌面端显示 -->
          <div class="card room-connection-desktop">
            <div class="card-header">
              <h3 class="card-title">房间连接</h3>
            </div>
            
            <div class="form-group">
              <label for="home-room-id-desktop" class="form-label">房间号</label>
              <div class="input-group">
                <input 
                  id="home-room-id-desktop"
                  name="roomIdDesktop"
                  type="text" 
                  class="form-control" 
                  v-model="roomId" 
                  placeholder="输入房间号或点击生成"
                  readonly
                  :disabled="isStreaming"
                />
                <button 
                  class="btn btn-secondary" 
                  @click="generateRoomIdHandler"
                  title="生成新房间号"
                  :disabled="isStreaming"
                  :class="{ 'disabled-btn': isStreaming }"
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
          
          <!-- 视频设置 -->
          <div class="card mt-4">
            <div class="card-header">
              <h3 class="card-title">视频设置</h3>
            </div>
            
            <CameraSelector v-model="selectedCameraId" :disabled="isStreaming" />
          </div>
          
          <!-- 音频设置 -->
          <div class="card mt-4">
            <div class="card-header">
              <h3 class="card-title">音频设置</h3>
            </div>
            
            <div class="form-group">
              <label for="home-audio-device" class="form-label">音频设备</label>
              <select id="home-audio-device" name="audioDevice" class="form-control" v-model="selectedAudioDeviceId" :disabled="isStreaming">
                <option value="">无音频</option>
                <option v-for="device in audioDevices" :key="device.deviceId" :value="device.deviceId">
                  {{ device.label || `音频设备 ${device.deviceId.slice(0, 8)}` }}
                </option>
              </select>
            </div>
            
            <div class="checkbox-group">
              <input 
                type="checkbox" 
                id="shareAudio" 
                name="shareAudio"
                v-model="settings.shareAudio"
                :disabled="isStreaming"
              />
              <label for="shareAudio">共享音频</label>
            </div>
            
            <button class="btn btn-secondary w-100 mt-2" @click="refreshAudioDevices">
              <i class="fas fa-sync-alt"></i>
              刷新设备列表
            </button>
          </div>
          
          <!-- 视频设置 -->
          <div class="card mt-4">
            <div class="card-header">
              <h3 class="card-title">视频设置</h3>
            </div>
            
            <div class="form-group">
              <label for="home-resolution" class="form-label">分辨率</label>
              <select id="home-resolution" name="resolution" class="form-control" v-model="settings.resolution" :disabled="isStreaming">
                <option value="720p">720p (1280×720)</option>
                <option value="1080p">1080p (1920×1080)</option>
                <option value="1440p">1440p (2560×1440)</option>
                <option value="4k">4K (3840×2160)</option>
                <option value="native">原生分辨率</option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="home-framerate" class="form-label">帧率</label>
              <select id="home-framerate" name="frameRate" class="form-control" v-model="settings.frameRate" :disabled="isStreaming">
                <option :value="15">15 FPS</option>
                <option :value="30">30 FPS</option>
                <option :value="60">60 FPS</option>
                <option :value="120">120 FPS</option>
                <option :value="144">144 FPS</option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="home-quality" class="form-label">画质预设</label>
              <select id="home-quality" name="quality" class="form-control" v-model="settings.quality" :disabled="isStreaming">
                <option value="balanced">均衡 (500-1000 kbps)</option>
                <option value="high">高质量 (2000-4000 kbps)</option>
                <option value="ultra">超高质量 (6000-8000 kbps)</option>
                <option value="lossless">无损 (10000+ kbps)</option>
              </select>
            </div>
            
            <div class="checkbox-group">
              <input 
                type="checkbox" 
                id="shareCursor" 
                name="shareCursor"
                v-model="settings.shareCursor"
                :disabled="isStreaming"
              />
              <label for="shareCursor">共享鼠标指针</label>
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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useWebRTCStore } from '@/stores'
import { useWebRTC } from '@/composables/useWebRTC'
import { useMediaStream } from '@/composables/useMediaStream'
import { generateRoomId, isMobile } from '@/utils/ui-utils'
import type { AudioDevice, WebRTCSettings } from '@/types/webrtc'
import ChatPanel from '@/components/Chat/ChatPanel.vue'
import StatusLog from '@/components/common/StatusLog.vue'
import CameraSelector from '@/components/common/CameraSelector.vue'

const store = useWebRTCStore()
const webrtc = useWebRTC()
const media = useMediaStream()

// 本地视频引用
const localVideo = ref<HTMLVideoElement | null>(null)

// 状态
const _roomId = ref('')
const roomId = computed({
  get: () => _roomId.value,
  set: (val: string) => { _roomId.value = val.toUpperCase() }
})
const currentStreamType = ref('')
const showPerfPanel = ref(true)
const isGettingStream = ref(false)
const isMobileDevice = isMobile()

// 性能监控
let performanceTimer: ReturnType<typeof setInterval> | null = null
let prevBytesSent = 0
let prevTimestamp = 0

// 摄像头列表
const cameras = ref<MediaDeviceInfo[]>([])
const selectedCameraId = ref('')

// 设置
const settings = ref<WebRTCSettings>({
  frameRate: 60,
  resolution: '1440p',
  quality: 'ultra',
  shareAudio: true,
  shareCursor: true
})

// 音频设备
const selectedAudioDeviceId = ref('')
const audioDevices = ref<AudioDevice[]>([])

// 计算属性
const isConnected = computed(() => store.isConnected)
const isStreaming = computed(() => store.isStreaming)
const localStream = computed(() => store.localStream)
const perfData = computed(() => store.performance)

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

// 方法
const generateRoomIdHandler = () => {
  roomId.value = generateRoomId()
  if (document.hasFocus()) {
    copyRoomId()
  }
}

const copyRoomId = async () => {
  if (!roomId.value) return
  try {
    await navigator.clipboard.writeText(roomId.value)
    store.updateStatus('房间号已复制到剪贴板', 'success')
  } catch (error) {
    // 静默失败
  }
}

const getScreenStream = async () => {
  // 页面加载期间（onMounted 的临时摄像头流进行中）isGettingStream 为 true，
  // 屏幕共享不依赖它，只靠自己守卫
  if (isGettingStream.value || isStreaming.value) return
  isGettingStream.value = true
  try {
    const stream = await media.getScreenShareStream()
    if (stream) {
      currentStreamType.value = 'screen'
      if (localVideo.value) {
        localVideo.value.srcObject = stream
        localVideo.value.play().catch(() => {})
      }
    }
  } finally {
    isGettingStream.value = false
  }
}

const getCameraStream = async () => {
  isGettingStream.value = true
  try {
    const constraints: MediaStreamConstraints = selectedCameraId.value 
      ? { video: { deviceId: { exact: selectedCameraId.value } } }
      : {}
    const stream = await media.getCameraStream(constraints)
    if (stream) {
      currentStreamType.value = 'camera'
      if (localVideo.value) {
        localVideo.value.srcObject = stream
        localVideo.value.play().catch(() => {})
      }
    }
  } finally {
    isGettingStream.value = false
  }
}

const startStreaming = async () => {
  if (!roomId.value || (!store.localStream && !store.screenStream)) {
    store.updateStatus('无法开始推流：房间号或视频流为空', 'error')
    return
  }
  
  try {
    sessionStorage.setItem('streamerRoomId', roomId.value)
    const type = store.screenStream ? 'screen' : 'camera'
    const success = await webrtc.startStreaming(roomId.value, type)
    if (success) {
      store.updateStatus('推流已开始', 'success')
      startPerformanceMonitoring()
    }
  } catch (error) {
    const err = error as Error
    store.updateStatus(`推流开始失败: ${err.message}`, 'error')
  }
}

const stopAll = () => {
  stopPerformanceMonitoring()
  
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

// 更新性能监控数据（推流端使用 outbound-rtp）
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

// 启动性能监控
const startPerformanceMonitoring = () => {
  if (performanceTimer) clearInterval(performanceTimer)
  prevBytesSent = 0
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

const refreshAudioDevices = async () => {
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
}

// 监听设置变化
watch(settings, (newSettings) => {
  store.updateSettings(newSettings)
}, { deep: true })

watch(selectedAudioDeviceId, (newDeviceId) => {
  store.setSelectedAudioDevice(newDeviceId)
})

// 检测页面刷新
const isPageReload = () => {
  try {
    const navigationEntries = window.performance.getEntriesByType('navigation')
    return navigationEntries.length > 0 && (navigationEntries[0] as PerformanceNavigationTiming).type === 'reload'
  } catch {
    return false
  }
}

// pageshow 事件处理 - 兼容 bfcache
const handlePageShow = (event: PageTransitionEvent) => {
  // event.persisted 表示页面是从 bfcache 恢复的
  if (event.persisted && store.isStreaming) {
    store.updateStatus('检测到页面恢复，清理状态...', 'info')
    webrtc.stopStreaming()
  }
}

// 生命周期
onMounted(async () => {
  await refreshAudioDevices()

  // 加载摄像头列表（移动端需要先请求权限才能获取真实设备名）
  try {
    let tempStream: MediaStream | null = null
    
    // 移动端先请求摄像头权限，以获取带真实 label 的设备列表
    if (isMobileDevice) {
      try {
        tempStream = await navigator.mediaDevices.getUserMedia({ video: true })
      } catch {
        // 权限被拒也能继续，enumerateDevices 仍能返回设备（只是没 label）
      }
    }
    
    const devices = await navigator.mediaDevices.enumerateDevices()
    cameras.value = devices.filter(d => d.kind === 'videoinput')
    
    // 移动端默认选择后置摄像头（需要真实 label 才能准确判断）
    if (isMobileDevice && cameras.value.length > 0) {
      const rearCamera = cameras.value.find(c => {
        const label = (c.label || '').toLowerCase()
        return label.includes('back') || label.includes('rear') || 
               label.includes('后置') || label.includes('environment')
      })
      selectedCameraId.value = rearCamera 
        ? rearCamera.deviceId 
        : cameras.value[cameras.value.length - 1].deviceId
    }
    
    // 释放临时流
    if (tempStream) {
      tempStream.getTracks().forEach(t => t.stop())
    }
  } catch (error) {
    console.error('加载摄像头列表失败:', error)
  }

  window.addEventListener('pageshow', handlePageShow)

  const savedRoomId = sessionStorage.getItem('streamerRoomId')
  if (isPageReload() && savedRoomId) {
    store.updateStatus('检测到页面刷新，清理状态...', 'info')
    sessionStorage.removeItem('streamerRoomId')
    store.cleanup()
  }

  generateRoomIdHandler()
  if (roomId.value) {
    sessionStorage.setItem('streamerRoomId', roomId.value)
  }
})

onUnmounted(() => {
  window.removeEventListener('pageshow', handlePageShow)
  stopPerformanceMonitoring()
  webrtc.stopStreaming()
  media.stopAllStreams()
})
</script>

<style scoped>
/* 仅保留 Home.vue 特有样式 */
.disabled-btn {
  opacity: 0.5;
  cursor: not-allowed;
}

.stream-controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.stream-controls .btn-primary {
  background: linear-gradient(135deg, #fb7299 0%, #fc8bab 100%);
  color: white;
  border: none;
}

.stream-controls .btn-primary:hover {
  background: linear-gradient(135deg, #fc8bab 0%, #fb7299 100%);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(251, 114, 153, 0.4);
}

.stream-controls .btn-secondary {
  background: linear-gradient(135deg, #7dd3fc 0%, #bae6fd 100%);
  color: #0f172a;
  border: none;
}

.stream-controls .btn-secondary:hover {
  background: linear-gradient(135deg, #bae6fd 0%, #7dd3fc 100%);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(125, 211, 252, 0.4);
}

.stream-controls .btn-danger {
  background: linear-gradient(135deg, #fda4af 0%, #fecdd3 100%);
  color: #9f1239;
  border: none;
}

.stream-controls .btn-danger:hover {
  background: linear-gradient(135deg, #fecdd3 0%, #fda4af 100%);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(253, 164, 175, 0.4);
}

.stream-controls .btn-success {
  background: linear-gradient(135deg, #86efac 0%, #bbf7d0 100%);
  color: #14532d;
  border: none;
}

.stream-controls .btn-success:hover {
  background: linear-gradient(135deg, #bbf7d0 0%, #86efac 100%);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(134, 239, 172, 0.4);
}

.flex-1 {
  flex: 1;
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

.connection-controls .btn-success {
  background: linear-gradient(135deg, #86efac 0%, #bbf7d0 100%);
  color: #14532d;
  border: none;
}

.connection-controls .btn-success:hover {
  background: linear-gradient(135deg, #bbf7d0 0%, #86efac 100%);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(134, 239, 172, 0.4);
}

.connection-controls .btn-danger {
  background: linear-gradient(135deg, #fda4af 0%, #fecdd3 100%);
  color: #9f1239;
  border: none;
}

.connection-controls .btn-danger:hover {
  background: linear-gradient(135deg, #fecdd3 0%, #fda4af 100%);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(253, 164, 175, 0.4);
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-weight: normal;
  padding: 0.5rem;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.radio-label:hover {
  background-color: #f8f9fa;
}

body.dark-theme .radio-label:hover {
  background-color: #4a5568;
}

.radio-label input[type="radio"] {
  margin: 0;
}

/* FontAwesome 图标大小 */
.fa-3x {
  font-size: 3em;
}

.fa-4x {
  font-size: 4em;
}
</style>
