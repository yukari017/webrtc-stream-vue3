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

.card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  padding: 0.6rem;
}

body.dark-theme .card {
  background: #2d3748;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.4rem;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid #eaeaea;
}

body.dark-theme .card-header {
  border-bottom-color: #4a5568;
}

.card-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: #2d3748;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

body.dark-theme .card-title {
  color: #e2e8f0;
}

.card-title i {
  color: #fb7299;
}

.form-group {
  margin-bottom: 0.4rem;
}

.form-label {
  display: block;
  margin-bottom: 0.3rem;
  font-weight: 500;
  font-size: 0.85rem;
  color: #495057;
}

body.dark-theme .form-label {
  color: #cbd5e0;
}

.form-control {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ced4da;
  border-radius: 6px;
  font-size: 0.85rem;
  background: #fff;
  color: #2d3748;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%234a5568'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.4rem center;
  background-size: 1.1rem;
  padding-right: 1.7rem;
}

body.dark-theme .form-control {
  background-color: #4a5568;
  border-color: #718096;
  color: #e2e8f0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23a0aec0'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
}

.form-control:focus {
  outline: none;
  border-color: #fb7299;
  box-shadow: 0 0 0 3px rgba(251, 114, 153, 0.15);
}

.form-control:disabled {
  background-color: #f7fafc;
  cursor: not-allowed;
  opacity: 0.6;
}

.checkbox-group {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.4rem;
}

.checkbox-group input[type="checkbox"] {
  appearance: none;
  -webkit-appearance: none;
  width: 1.1rem;
  height: 1.1rem;
  border: 2px solid #cbd5e0;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
}

.checkbox-group input[type="checkbox"]:hover {
  border-color: #fb7299;
}

.checkbox-group input[type="checkbox"]:checked {
  background: linear-gradient(135deg, #fb7299 0%, #fc8bab 100%);
  border-color: #fb7299;
}

.checkbox-group input[type="checkbox"]:checked::after {
  content: '';
  position: absolute;
  left: 3.5px;
  top: 0.5px;
  width: 4.5px;
  height: 8px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.checkbox-group label {
  font-size: 0.85rem;
  color: #495057;
  cursor: pointer;
}

body.dark-theme .checkbox-group label {
  color: #cbd5e0;
}

.btn {
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 0.85rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  transition: all 0.2s;
  font-weight: 500;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-sm {
  padding: 0.35rem 0.45rem;
  font-size: 0.75rem;
}

.btn-secondary {
  background: linear-gradient(135deg, #7dd3fc 0%, #bae6fd 100%);
  color: #0f172a;
}

.btn-secondary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(125, 211, 252, 0.4);
}

.w-100 {
  width: 100%;
}

.mt-2 {
  margin-top: 0.4rem;
}

.mt-4 {
  margin-top: 0.4rem;
}
</style>
