import { defineStore } from 'pinia'
import type { 
  WebRTCSettings, 
  PerformanceData, 
  StatusHistoryItem, 
  AudioDevice 
} from '@/types/webrtc'

interface WebRTCState {
  // 连接状态
  isConnected: boolean
  isStreaming: boolean
  roomId: string
  clientId: string
  
  // 媒体流
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  screenStream: MediaStream | null
  audioStream: MediaStream | null
  
  // 设备
  selectedAudioDeviceId: string | null
  audioDevices: AudioDevice[]
  
  // WebRTC
  peerConnection: RTCPeerConnection | null
  signalingSocket: WebSocket | null
  
  // 状态
  status: string
  statusType: 'info' | 'warning' | 'error' | 'success'
  statusHistory: StatusHistoryItem[]
  
  // 重连计数
  signalingReconnectAttempts: number
  iceRestartAttempts: number
  
  // 设置
  settings: WebRTCSettings
  
  // 性能监控
  performance: PerformanceData
}

export const useWebRTCStore = defineStore('webrtc', {
  state: (): WebRTCState => ({
    // 连接状态
    isConnected: false,
    isStreaming: false,
    roomId: '',
    clientId: '',
    
    // 媒体流
    localStream: null,
    remoteStream: null,
    screenStream: null,
    audioStream: null,
    
    // 设备
    selectedAudioDeviceId: null,
    audioDevices: [],
    
    // WebRTC
    peerConnection: null,
    signalingSocket: null,
    
    // 状态
    status: '就绪',
    statusType: 'info',
    statusHistory: [],
    
    // 重连计数
    signalingReconnectAttempts: 0,
    iceRestartAttempts: 0,
    
    // 设置
    settings: {
      frameRate: 60,
      resolution: '1440p',
      quality: 'ultra',
      shareAudio: true,
      shareCursor: true
    },
    
    // 性能监控
    performance: {
      bitrate: 0,
      resolution: '0×0',
      framerate: 0,
      packetLoss: 0,
      rtt: 0
    }
  }),
  
  actions: {
    // 更新状态
    updateStatus(message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info') {
      const timestamp = new Date().toLocaleTimeString()
      this.status = message
      this.statusType = type
      
      // 添加到历史记录
      this.statusHistory.push({
        timestamp,
        message,
        type
      })
      
      // 限制历史记录数量
      if (this.statusHistory.length > 30) {
        this.statusHistory.shift()
      }
    },
    
    // 清除状态
    clearStatus() {
      this.status = '就绪'
      this.statusType = 'info'
      this.statusHistory = []
    },
    
    // 设置房间
    setRoom(roomId: string) {
      this.roomId = roomId
    },
    
    // 设置客户端ID
    setClientId(clientId: string) {
      this.clientId = clientId
    },
    
    // 设置连接状态
    setConnected(connected: boolean) {
      this.isConnected = connected
    },
    
    // 设置推流状态
    setStreaming(streaming: boolean) {
      this.isStreaming = streaming
    },
    
    // 设置本地流
    setLocalStream(stream: MediaStream | null) {
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop())
      }
      this.localStream = stream
    },
    
    // 设置远程流
    setRemoteStream(stream: MediaStream | null) {
      if (this.remoteStream) {
        this.remoteStream.getTracks().forEach(track => track.stop())
      }
      this.remoteStream = stream
    },
    
    // 设置屏幕流
    setScreenStream(stream: MediaStream | null) {
      if (this.screenStream) {
        this.screenStream.getTracks().forEach(track => track.stop())
      }
      this.screenStream = stream
    },
    
    // 设置音频流
    setAudioStream(stream: MediaStream | null) {
      if (this.audioStream) {
        this.audioStream.getTracks().forEach(track => track.stop())
      }
      this.audioStream = stream
    },
    
    // 设置音频设备
    setAudioDevices(devices: AudioDevice[]) {
      this.audioDevices = devices
    },
    
    // 设置选中的音频设备
    setSelectedAudioDevice(deviceId: string | null) {
      this.selectedAudioDeviceId = deviceId
    },
    
    // 设置 PeerConnection
    setPeerConnection(pc: RTCPeerConnection | null) {
      if (this.peerConnection) {
        this.peerConnection.close()
      }
      this.peerConnection = pc
    },
    
    // 设置信令Socket
    setSignalingSocket(socket: WebSocket | null) {
      if (this.signalingSocket) {
        this.signalingSocket.close()
      }
      this.signalingSocket = socket
    },
    
    // 更新设置
    updateSettings(newSettings: Partial<WebRTCSettings>) {
      this.settings = { ...this.settings, ...newSettings }
    },
    
    // 更新性能数据
    updatePerformance(data: Partial<PerformanceData>) {
      this.performance = { ...this.performance, ...data }
    },
    
    // 增加重连计数
    incrementReconnectAttempts() {
      this.signalingReconnectAttempts++
    },
    
    // 增加ICE重启计数
    incrementIceRestartAttempts() {
      this.iceRestartAttempts++
    },
    
    // 重置重连计数
    resetReconnectAttempts() {
      this.signalingReconnectAttempts = 0
    },
    
    // 重置ICE重启计数
    resetIceRestartAttempts() {
      this.iceRestartAttempts = 0
    },
    
    // 清理所有资源
    cleanup() {
      if (this.peerConnection) {
        this.peerConnection.close()
        this.peerConnection = null
      }
      
      if (this.signalingSocket) {
        this.signalingSocket.close()
        this.signalingSocket = null
      }
      
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop())
        this.localStream = null
      }
      
      if (this.remoteStream) {
        this.remoteStream.getTracks().forEach(track => track.stop())
        this.remoteStream = null
      }
      
      if (this.screenStream) {
        this.screenStream.getTracks().forEach(track => track.stop())
        this.screenStream = null
      }
      
      if (this.audioStream) {
        this.audioStream.getTracks().forEach(track => track.stop())
        this.audioStream = null
      }
      
      this.isConnected = false
      this.isStreaming = false
      this.roomId = ''
      this.clientId = ''
      this.resetReconnectAttempts()
      this.resetIceRestartAttempts()
      this.updateStatus('已清理所有资源', 'info')
    }
  },
  
  getters: {
    // 获取当前状态
    currentStatus: (state): StatusHistoryItem => ({
      message: state.status,
      type: state.statusType,
      timestamp: new Date().toLocaleTimeString()
    }),
    
    // 获取状态历史
    statusLog: (state): StatusHistoryItem[] => state.statusHistory,
    
    // 获取连接信息
    connectionInfo: (state) => ({
      isConnected: state.isConnected,
      isStreaming: state.isStreaming,
      roomId: state.roomId,
      clientId: state.clientId
    }),
    
    // 获取性能信息
    performanceInfo: (state): PerformanceData => state.performance,
    
    // 获取设置
    currentSettings: (state): WebRTCSettings => state.settings,
    
    // 获取音频设备
    availableAudioDevices: (state): AudioDevice[] => state.audioDevices,
    
    // 获取选中的音频设备
    selectedAudioDevice: (state): AudioDevice | undefined => 
      state.audioDevices.find(device => device.deviceId === state.selectedAudioDeviceId)
  }
})
