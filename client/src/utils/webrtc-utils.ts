import { isAndroidTablet, isMobile } from './ui-utils'

const IS_ANDROID_TABLET = isAndroidTablet()
const _IS_MOBILE = isMobile()
void _IS_MOBILE

export type VideoCodec = 'vp9' | 'vp8' | 'h264' | 'av1'

interface CodecPreference {
  mimeType: string
  sdpFmtpLine?: string
}

const CODEC_PREFERENCES: Record<VideoCodec, CodecPreference> = {
  vp9: { mimeType: 'video/VP9', sdpFmtpLine: 'profile-id=0' },
  vp8: { mimeType: 'video/VP8' },
  h264: { mimeType: 'video/H264', sdpFmtpLine: 'level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f' },
  av1: { mimeType: 'video/AV1' }
}

export function getSupportedCodecs(): VideoCodec[] {
  const supported: VideoCodec[] = []
  const capabilities = RTCRtpSender.getCapabilities('video')
  
  if (!capabilities) return ['h264']
  
  const codecs = capabilities.codecs || []
  
  for (const [codec] of Object.entries(CODEC_PREFERENCES)) {
    const pref = CODEC_PREFERENCES[codec as VideoCodec]
    const isSupported = codecs.some(c => 
      c.mimeType.toLowerCase() === pref.mimeType.toLowerCase()
    )
    if (isSupported) {
      supported.push(codec as VideoCodec)
    }
  }
  
  return supported.length > 0 ? supported : ['h264']
}

export function getBestCodec(): VideoCodec {
  const supported = getSupportedCodecs()
  const priority: VideoCodec[] = ['vp9', 'av1', 'h264', 'vp8']
  
  for (const codec of priority) {
    if (supported.includes(codec)) {
      return codec
    }
  }
  
  return 'h264'
}

interface ResolutionConstraints {
  width: { ideal: number; max: number }
  height: { ideal: number; max: number }
}

interface ScreenStreamOptions {
  frameRate?: number
  resolution?: string
  shareAudio?: boolean
  shareCursor?: boolean
  onAndroidTablet?: boolean
}

interface AudioStreamOptions {
  echoCancellation?: boolean
  noiseSuppression?: boolean
  autoGainControl?: boolean
  sampleRate?: number
  channelCount?: number
}

// 设备缓存
interface DeviceCache {
  devices: MediaDeviceInfo[]
  timestamp: number
}

const deviceCache: DeviceCache = { devices: [], timestamp: 0 }

/**
 * 获取分辨率约束
 */
export function getResolutionConstraints(resolution: string): ResolutionConstraints {
  switch (resolution) {
    case '720p':
      return { width: { ideal: 1280, max: 1920 }, height: { ideal: 720, max: 1080 } }
    case '1080p':
      return { width: { ideal: 1920, max: 2560 }, height: { ideal: 1080, max: 1440 } }
    case '1440p':
      return { width: { ideal: 2560, max: 3840 }, height: { ideal: 1440, max: 2160 } }
    case '4k':
      return { width: { ideal: 3840, max: 3840 }, height: { ideal: 2160, max: 2160 } }
    case 'native':
      return { 
        width: { ideal: screen.width, max: screen.width * 2 },
        height: { ideal: screen.height, max: screen.height * 2 }
      }
    default:
      return { width: { ideal: 1920, max: 2560 }, height: { ideal: 1080, max: 1440 } }
  }
}

/**
 * 根据分辨率选项返回推荐基础码率（kbps）
 */
export function getBaseBitrateKbpsForResolution(resolutionValue: string): number {
  switch (resolutionValue) {
    case '720p':
      return 3000
    case '1080p':
      return 5000
    case '1440p':
      return 10000
    case '4k':
    case 'native':
      return 20000
    default:
      return 5000
  }
}

/**
 * 按画质预设抬高码率下限
 */
export function applyQualityPresetToBitrate(baseBitrateKbps: number, preset?: string): number {
  if (!preset) return baseBitrateKbps
  let target = baseBitrateKbps
  switch (preset) {
    case 'balanced':
      target = Math.max(target, 5000)
      break
    case 'high':
      target = Math.max(target, 10000)
      break
    case 'ultra':
      target = Math.max(target, 20000)
      break
    case 'lossless':
      target = Math.max(target, 40000)
      break
  }
  return target
}

/**
 * 请求音频权限（移动端必须先获取权限才能拿到真实的 deviceId）
 */
export async function requestAudioPermission(): Promise<MediaStream | null> {
  try {
    // 先尝试用最简单的约束获取权限
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    console.log('音频权限获取成功')
    return stream
  } catch (error) {
    console.warn('获取音频权限失败:', error)
    return null
  }
}

/**
 * 获取音频设备列表
 * @param force 强制刷新缓存
 * @param ensurePermission 是否先请求权限（移动端需要）
 */
export async function getAudioDevices(force = false, ensurePermission = false): Promise<MediaDeviceInfo[]> {
  const AUDIO_DEVICE_CACHE_MS = 5000
  const now = Date.now()
  
  // 如果需要确保权限，先请求一次
  if (ensurePermission) {
    const permStream = await requestAudioPermission()
    if (permStream) {
      // 立即释放权限流
      permStream.getTracks().forEach(t => t.stop())
    }
  }
  
  if (!force && deviceCache.devices.length && (now - deviceCache.timestamp < AUDIO_DEVICE_CACHE_MS)) {
    return deviceCache.devices
  }
  
  const devices = await navigator.mediaDevices.enumerateDevices()
  const audioDevices = devices.filter(d => d.kind === 'audioinput')
  
  // 过滤掉无效的设备（移动端在未授权时可能返回 deviceId 为空或 default）
  const validDevices = audioDevices.filter(d => d.deviceId && d.deviceId !== '')
  
  deviceCache.devices = validDevices.length > 0 ? validDevices : audioDevices
  deviceCache.timestamp = now
  
  console.log(`发现 ${audioDevices.length} 个音频设备，有效 ${validDevices.length} 个`)
  
  return deviceCache.devices
}

/**
 * 获取屏幕共享流
 */
export interface ScreenStreamResult {
  stream: MediaStream
  isFallback: boolean       // 是否回退到摄像头
  failedReason: string | null  // 回退原因（仅在 isFallback=true 时有值）
}

/**
 * 获取屏幕共享流
 * 移动端不支持屏幕共享时自动回退到后置摄像头
 */
export async function getScreenStream(options: ScreenStreamOptions = {}): Promise<ScreenStreamResult> {
  const {
    frameRate = 30,
    resolution = '1080p',
    shareAudio = false,
    shareCursor = true,
    onAndroidTablet = IS_ANDROID_TABLET
  } = options

  console.log('getScreenStream 调用，参数:', options)
  
  const resolutionConstraints = getResolutionConstraints(resolution)
  console.log('分辨率约束:', resolutionConstraints)
  
  let usedResolution = resolutionConstraints
  let usedFrameRate = frameRate
  if (onAndroidTablet) {
    usedResolution = { width: { ideal: 1280, max: 1920 }, height: { ideal: 720, max: 1080 } }
    usedFrameRate = Math.min(frameRate, 30)
    console.log('Android平板模式，调整参数:', { usedResolution, usedFrameRate })
  }

  const constraints: MediaStreamConstraints & { audio?: boolean; video: MediaTrackConstraints & { cursor?: string } } = {
    video: {
      // 'monitor': 整个屏幕（桌面端默认）
      // 'window': 单个窗口
      // 'browser': 浏览器标签页
      // 'any': 所有类型（移动端必须用 any，否则 Android 部分设备报错）
      // 桌面端尝试默认选择整个屏幕，移动端保持 any 兼容性
      displaySurface: isMobile() ? 'any' : 'monitor',
      width: usedResolution.width,
      height: usedResolution.height,
      frameRate: { ideal: usedFrameRate, max: usedFrameRate }
    }
  }

  if (shareAudio) {
    constraints.audio = true
  }

  // 添加 cursor 选项（非标准属性，需要类型断言）
  if (shareCursor) {
    (constraints.video as MediaTrackConstraints & { cursor?: string }).cursor = 'always'
  }

  console.log('屏幕共享约束条件:', constraints)
  
  let stream: MediaStream | null = null
  let screenShareFailedReason: string | null = null
  
  if (navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
    console.log('浏览器支持 getDisplayMedia，尝试获取屏幕共享...')
    try {
      stream = await navigator.mediaDevices.getDisplayMedia(constraints)
      console.log('getDisplayMedia 成功')
    } catch (err) {
      const error = err as Error
      // 用户取消选择（常见）或浏览器不支持
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        screenShareFailedReason = '用户取消了屏幕共享选择'
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        screenShareFailedReason = '未找到可用的屏幕或窗口'
      } else if (error.name === 'NotSupportedError') {
        screenShareFailedReason = '当前浏览器不支持屏幕共享'
      } else {
        screenShareFailedReason = error.message || '屏幕共享失败'
      }
      console.warn(`getDisplayMedia 失败: ${screenShareFailedReason}`)
      stream = null
    }
  } else {
    screenShareFailedReason = '当前浏览器不支持屏幕共享'
    console.warn('浏览器不支持 getDisplayMedia')
  }

  if (!stream) {
    // 尝试回退到后置摄像头（Android/iOS 移动端场景）
    console.log('尝试回退到后置摄像头...')
    try {
      const cameraConstraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: usedResolution.width,
          height: usedResolution.height,
          frameRate: { ideal: usedFrameRate, max: usedFrameRate }
        },
        audio: false
      }
      
      stream = await navigator.mediaDevices.getUserMedia(cameraConstraints)
      console.log('摄像头回退成功，标记为非屏幕共享模式')
    } catch (camErr) {
      const camError = camErr as Error
      const baseMsg = screenShareFailedReason 
        ? `${screenShareFailedReason}，且摄像头采集也失败` 
        : '无法获取屏幕或摄像头视频流'
      throw new Error(`${baseMsg}: ${camError.message}`)
    }
  }

  if (!stream) {
    throw new Error('获取到的流为null或undefined')
  }
  
  const videoTrack = stream.getVideoTracks()[0]
  if (!videoTrack) {
    throw new Error('未获取到视频轨道')
  }

  return {
    stream,
    isFallback: screenShareFailedReason !== null,
    failedReason: screenShareFailedReason
  }
}

/**
 * 获取音频流
 * @param deviceId 设备 ID，如果为空则使用默认设备
 * @param options 音频约束选项
 */
export async function getAudioStream(deviceId: string | null, options: AudioStreamOptions = {}): Promise<MediaStream | null> {
  const {
    echoCancellation = false,
    noiseSuppression = false,
    autoGainControl = false,
    sampleRate = 48000,
    channelCount = 2
  } = options

  // 构建音频约束
  const audioConstraints: MediaTrackConstraints = {
    echoCancellation,
    noiseSuppression,
    autoGainControl,
    sampleRate,
    channelCount
  }

  // 如果有有效的 deviceId，使用 exact 约束
  if (deviceId && deviceId !== '' && deviceId !== 'default') {
    audioConstraints.deviceId = { exact: deviceId }
  }

  try {
    console.log('尝试获取音频流，约束:', audioConstraints)
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints
    })
    console.log('音频流获取成功:', stream.getAudioTracks()[0]?.label)
    return stream
  } catch (error) {
    console.warn('获取音频流失败（精确匹配），尝试使用默认设备:', error)
    
    // Fallback: 使用默认设备
    try {
      const fallbackStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation,
          noiseSuppression,
          autoGainControl
        }
      })
      console.log('使用默认音频设备成功:', fallbackStream.getAudioTracks()[0]?.label)
      return fallbackStream
    } catch (fallbackError) {
      console.error('获取音频流最终失败:', fallbackError)
      return null
    }
  }
}

/**
 * 创建 PeerConnection 配置
 */
export function createPeerConnectionConfig(): RTCConfiguration {
  return {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  }
}

/**
 * 设置视频编码器参数
 */
export async function applySenderParameters(
  sender: RTCRtpSender,
  targetBitrateKbps: number,
  preferredCodec?: VideoCodec
): Promise<boolean> {
  if (!sender || !sender.track || sender.track.kind !== 'video') {
    return false
  }

  try {
    const params = sender.getParameters() as RTCRtpSendParameters
    
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{ rid: '1' } as RTCRtpEncodingParameters]
    }

    const targetBps = Math.max(100000, Math.floor(targetBitrateKbps * 1000))
    params.encodings[0].maxBitrate = targetBps

    if (IS_ANDROID_TABLET) {
      params.encodings[0].scaleResolutionDownBy = params.encodings[0].scaleResolutionDownBy || 1.5
    } else {
      params.encodings[0].scaleResolutionDownBy = params.encodings[0].scaleResolutionDownBy || 1
    }

    params.encodings[0].active = true

    const codec = preferredCodec || getBestCodec()
    const codecPref = CODEC_PREFERENCES[codec]
    
    if (params.codecs && params.codecs.length > 0) {
      const preferredCodecs = params.codecs.filter(c => 
        c.mimeType.toLowerCase() === codecPref.mimeType.toLowerCase()
      )
      
      if (preferredCodecs.length > 0) {
        const otherCodecs = params.codecs.filter(c => 
          c.mimeType.toLowerCase() !== codecPref.mimeType.toLowerCase()
        )
        params.codecs = [...preferredCodecs, ...otherCodecs]
      }
    }

    await sender.setParameters(params)
    console.log(`视频编码器设置: ${codec.toUpperCase()}, 码率: ${targetBitrateKbps}kbps`)
    return true
  } catch (error) {
    console.warn('无法应用 sender 参数:', error)
    return false
  }
}

/**
 * 设置 SDP 带宽限制
 */
export function setSdpBandwidth(sdp: string | undefined, targetBitrateKbps: number): string | undefined {
  if (!sdp || !sdp.includes('m=video')) {
    return sdp
  }
  
  return sdp.replace(/(m=video.*\r\n)/g, `$1b=AS:${targetBitrateKbps}\r\n`)
}

/**
 * 设置视频轨道 contentHint
 */
export function setVideoContentHint(videoTrack: MediaStreamTrack, hint: 'detail' | 'motion' | 'text' = 'detail'): boolean {
  if (videoTrack && 'contentHint' in videoTrack) {
    try {
      videoTrack.contentHint = hint
      return true
    } catch (e) {
      console.warn('设置 contentHint 失败', e)
    }
  }
  return false
}
