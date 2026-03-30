import { ref, onUnmounted } from 'vue'
import { useWebRTCStore } from '@/stores'
import type { AudioDevice } from '@/types/webrtc'
import { 
  getScreenStream, 
  getAudioStream, 
  getAudioDevices,
  getResolutionConstraints,
  getBaseBitrateKbpsForResolution,
  applyQualityPresetToBitrate,
  setVideoContentHint
} from '@/utils/webrtc-utils'
import { isMobile } from '@/utils/ui-utils'

export function useMediaStream() {
  const store = useWebRTCStore()
  
  const isGettingStream = ref(false)
  const streamError = ref<string | null>(null)
  
  // 获取屏幕共享流
  const getScreenShareStream = async (): Promise<MediaStream | null> => {
    if (isGettingStream.value) return null
    isGettingStream.value = true
    streamError.value = null
    
    try {
      const { frameRate, resolution, shareAudio, shareCursor } = store.settings
      
      const result = await getScreenStream({
        frameRate,
        resolution,
        shareAudio,
        shareCursor
      })
      
      const { stream, isFallback } = result
      
      if (!stream) {
        throw new Error('getScreenStream 返回空流')
      }
      
      const videoTrack = stream.getVideoTracks()[0]
      if (videoTrack) {
        setVideoContentHint(videoTrack, isFallback ? 'motion' : 'detail')
      } else {
        console.warn('流中没有视频轨道')
      }
      
      store.setScreenStream(stream)
      
      if (isFallback) {
        store.updateStatus(`屏幕共享不可用，已切换到后置摄像头`, 'warning')
      } else {
        store.updateStatus('屏幕共享流获取成功', 'success')
      }
      
      return stream
    } catch (error) {
      console.error('获取屏幕共享流失败:', error)
      streamError.value = (error as Error).message
      store.updateStatus(`获取屏幕共享流失败: ${(error as Error).message}`, 'error')
      return null
    } finally {
      isGettingStream.value = false
    }
  }
  
  // 获取摄像头流
  const getCameraStream = async (constraints: MediaStreamConstraints = {}): Promise<MediaStream | null> => {
    if (isGettingStream.value) return null
    isGettingStream.value = true
    streamError.value = null
    
    try {
      const { frameRate, resolution } = store.settings
      const resolutionConstraints = getResolutionConstraints(resolution)
      
      const defaultVideoConstraints = {
        width: resolutionConstraints.width,
        height: resolutionConstraints.height,
        frameRate: { ideal: frameRate, max: frameRate }
      }
      
      const defaultConstraints: MediaStreamConstraints = {
        video: defaultVideoConstraints,
        audio: false
      }
      
      const constraintsVideo = typeof constraints.video === 'object' ? constraints.video : {}
      const finalConstraints: MediaStreamConstraints = {
        ...defaultConstraints,
        ...constraints,
        video: {
          ...defaultVideoConstraints,
          ...constraintsVideo
        }
      }
      
      const stream = await navigator.mediaDevices.getUserMedia(finalConstraints)
      
      const videoTrack = stream.getVideoTracks()[0]
      if (videoTrack) {
        setVideoContentHint(videoTrack, 'motion')
      }
      
      store.setLocalStream(stream)
      store.updateStatus('摄像头流获取成功', 'success')
      
      return stream
    } catch (error) {
      console.error('获取摄像头流失败:', error)
      streamError.value = (error as Error).message
      store.updateStatus(`获取摄像头流失败: ${(error as Error).message}`, 'error')
      return null
    } finally {
      isGettingStream.value = false
    }
  }
  
  // 获取音频流
  const getAudioInputStream = async (deviceId: string | null = null): Promise<MediaStream | null> => {
    if (isGettingStream.value) return null
    isGettingStream.value = true
    streamError.value = null
    
    try {
      // 允许 deviceId 为空，getAudioStream 会使用默认设备
      const deviceToUse = deviceId || store.selectedAudioDeviceId || null
      
      const stream = await getAudioStream(deviceToUse, {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      })
      
      if (stream) {
        store.setAudioStream(stream)
        store.updateStatus('音频流获取成功', 'success')
      }
      
      return stream
    } catch (error) {
      console.error('获取音频流失败:', error)
      streamError.value = (error as Error).message
      store.updateStatus(`获取音频流失败: ${(error as Error).message}`, 'error')
      return null
    } finally {
      isGettingStream.value = false
    }
  }
  
  // 刷新音频设备列表
  const refreshAudioDevices = async (force = false): Promise<AudioDevice[]> => {
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      
      if (permissionStatus.state === 'denied') {
        store.updateStatus('麦克风权限已被拒绝，请在浏览器设置中允许麦克风权限', 'error')
        return []
      }
      
      const needPermission = isMobile() || permissionStatus.state === 'prompt'
      
      const devices = await getAudioDevices(force, needPermission || force)
      
      const audioDevices: AudioDevice[] = devices.map(d => ({
        deviceId: d.deviceId,
        label: d.label,
        kind: d.kind
      }))
      store.setAudioDevices(audioDevices)
      
      if (audioDevices.length > 0) {
        // 优先选择有真实名称的设备
        const firstRealDevice = audioDevices.find(d => d.label && d.label !== '')
        if (firstRealDevice) {
          store.setSelectedAudioDevice(firstRealDevice.deviceId)
        } else if (!store.selectedAudioDeviceId) {
          // 如果都没有名称，使用第一个
          store.setSelectedAudioDevice(audioDevices[0].deviceId)
        }
      }
      
      return audioDevices
    } catch (error) {
      console.error('刷新音频设备失败:', error)
      return []
    }
  }
  
  // 合并音视频流
  const mergeStreams = (videoStream: MediaStream | null, audioStream: MediaStream | null): MediaStream | null => {
    if (!videoStream) return null
    
    const mergedStream = new MediaStream()
    
    videoStream.getVideoTracks().forEach(track => {
      mergedStream.addTrack(track)
    })
    
    if (audioStream) {
      audioStream.getAudioTracks().forEach(track => {
        mergedStream.addTrack(track)
      })
    }
    
    return mergedStream
  }
  
  // 获取目标比特率
  const getTargetBitrate = (): number => {
    const { resolution, quality } = store.settings
    const baseBitrate = getBaseBitrateKbpsForResolution(resolution)
    return applyQualityPresetToBitrate(baseBitrate, quality)
  }
  
  // 停止所有流
  const stopAllStreams = (): void => {
    if (store.localStream) {
      store.localStream.getTracks().forEach(track => track.stop())
      store.setLocalStream(null)
    }
    
    if (store.screenStream) {
      store.screenStream.getTracks().forEach(track => track.stop())
      store.setScreenStream(null)
    }
    
    if (store.audioStream) {
      store.audioStream.getTracks().forEach(track => track.stop())
      store.setAudioStream(null)
    }
    
    store.updateStatus('已停止所有媒体流', 'info')
  }
  
  // 切换音频设备
  const switchAudioDevice = async (deviceId: string): Promise<boolean> => {
    if (!deviceId) return false
    
    try {
      if (store.audioStream) {
        store.audioStream.getTracks().forEach(track => track.stop())
      }
      
      const newAudioStream = await getAudioInputStream(deviceId)
      
      if (newAudioStream) {
        store.setSelectedAudioDevice(deviceId)
        return true
      }
      
      return false
    } catch (error) {
      console.error('切换音频设备失败:', error)
      store.updateStatus('切换音频设备失败', 'error')
      return false
    }
  }
  
  onUnmounted(() => {
    stopAllStreams()
  })
  
  return {
    getScreenShareStream,
    getCameraStream,
    getAudioInputStream,
    
    refreshAudioDevices,
    switchAudioDevice,
    
    mergeStreams,
    stopAllStreams,
    
    getTargetBitrate,
    
    isGettingStream,
    streamError,
    
    audioDevices: () => store.audioDevices,
    selectedAudioDeviceId: () => store.selectedAudioDeviceId
  }
}
