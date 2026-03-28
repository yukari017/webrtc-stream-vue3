<template>
  <div class="mobile-settings-tab">
    <div class="settings-section">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">
            <i class="fas fa-video"></i>
            视频设置
          </h3>
        </div>
        
        <div class="form-group">
          <label for="mobile-camera" class="form-label">摄像头</label>
          <select id="mobile-camera" class="form-control" :value="selectedCameraId" @change="$emit('update:selectedCameraId', ($event.target as HTMLSelectElement).value)" :disabled="isStreaming">
            <option value="">默认摄像头</option>
            <option v-for="camera in cameras" :key="camera.deviceId" :value="camera.deviceId">
              {{ translateCameraLabel(camera.label) || `摄像头 ${camera.deviceId.slice(0, 8)}` }}
            </option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="mobile-resolution" class="form-label">分辨率</label>
          <select id="mobile-resolution" class="form-control" v-model="localSettings.resolution" :disabled="isStreaming">
            <option value="720p">720p (1280×720)</option>
            <option value="1080p">1080p (1920×1080)</option>
            <option value="1440p">1440p (2560×1440)</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="mobile-framerate" class="form-label">帧率</label>
          <select id="mobile-framerate" class="form-control" v-model.number="localSettings.frameRate" :disabled="isStreaming">
            <option :value="15">15 FPS</option>
            <option :value="30">30 FPS</option>
            <option :value="60">60 FPS</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="mobile-quality" class="form-label">画质预设</label>
          <select id="mobile-quality" class="form-control" v-model="localSettings.quality" :disabled="isStreaming">
            <option value="balanced">均衡 (500-1000 kbps)</option>
            <option value="high">高质量 (2000-4000 kbps)</option>
            <option value="ultra">超高质量 (6000-8000 kbps)</option>
          </select>
        </div>
      </div>
      
      <div class="card mt-4">
        <div class="card-header">
          <h3 class="card-title">
            <i class="fas fa-microphone"></i>
            音频设置
          </h3>
        </div>
        
        <div class="form-group">
          <label for="mobile-audio-device" class="form-label">音频设备</label>
          <select id="mobile-audio-device" class="form-control" :value="selectedAudioDeviceId" @change="$emit('update:selectedAudioDeviceId', ($event.target as HTMLSelectElement).value)" :disabled="isStreaming">
            <option value="">无音频</option>
            <option v-for="device in audioDevices" :key="device.deviceId" :value="device.deviceId">
              {{ device.label || `音频设备 ${device.deviceId.slice(0, 8)}` }}
            </option>
          </select>
        </div>
        
        <div class="checkbox-group">
          <input
            type="checkbox"
            id="mobile-share-audio"
            v-model="localSettings.shareAudio"
            :disabled="isStreaming"
          />
          <label for="mobile-share-audio">共享音频</label>
        </div>
        
        <button class="btn btn-secondary w-100 mt-2" @click="refreshDevices">
          <i class="fas fa-sync-alt"></i>
          刷新设备列表
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useWebRTCStore } from '@/stores'
import { translateCameraLabel } from '@/utils/ui-utils'
import type { WebRTCSettings, AudioDevice } from '@/types/webrtc'

const props = defineProps<{
  selectedCameraId: string
  selectedAudioDeviceId: string
  settings: WebRTCSettings
  cameras: MediaDeviceInfo[]
  audioDevices: AudioDevice[]
}>()

const emit = defineEmits<{
  'update:selectedCameraId': [value: string]
  'update:selectedAudioDeviceId': [value: string]
  'update:settings': [value: WebRTCSettings]
  'refreshDevices': []
}>()

const store = useWebRTCStore()

const localSettings = ref<WebRTCSettings>({ ...props.settings })

const isStreaming = computed(() => store.isStreaming)

watch(localSettings, (newSettings) => {
  emit('update:settings', { ...newSettings })
}, { deep: true })

watch(() => props.settings, (newSettings) => {
  localSettings.value = { ...newSettings }
}, { deep: true })

const refreshDevices = () => {
  emit('refreshDevices')
}
</script>

<style scoped>
.mobile-settings-tab {
  position: fixed;
  top: 56px;
  left: 0;
  right: 0;
  bottom: 56px;
  overflow-y: auto;
  padding: 0.4rem;
}

.settings-section {
  display: flex;
  flex-direction: column;
}

/* 卡片、表单、按钮样式已在全局 mobile-common.css 和 components.css 中定义 */

.card-title i {
  color: #fb7299;
}

.w-100 {
  width: 100%;
}
</style>
