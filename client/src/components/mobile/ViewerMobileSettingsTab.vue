<template>
  <div class="viewer-settings-tab">
    <div class="settings-section">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">
            <i class="fas fa-play-circle"></i>
            播放控制
          </h3>
        </div>
        
        <div class="checkbox-group">
          <input
            type="checkbox"
            id="viewer-auto-reconnect"
            :checked="autoReconnect"
            @change="$emit('update:autoReconnect', ($event.target as HTMLInputElement).checked)"
          />
          <label for="viewer-auto-reconnect">自动重连</label>
        </div>
        
        <div class="slider-group mt-4">
          <label for="viewer-volume" class="form-label">音量</label>
          <input
            id="viewer-volume"
            name="volume"
            type="range"
            min="0"
            max="100"
            :value="volume"
            @input="handleVolumeChange"
            class="volume-slider"
          />
          <div class="slider-value">{{ volume }}%</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  autoReconnect: boolean
  volume: number
}>()

const emit = defineEmits<{
  'update:autoReconnect': [value: boolean]
  'update:volume': [value: number]
  'updateVolume': [value: number]
}>()

const handleVolumeChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const value = parseInt(target.value, 10)
  emit('update:volume', value)
  emit('updateVolume', value)
}
</script>

<style scoped>
.viewer-settings-tab {
  position: fixed;
  top: 56px;
  left: 0;
  right: 0;
  bottom: 56px;
  overflow-y: auto;
  padding: 0.5rem;
}

.settings-section {
  display: flex;
  flex-direction: column;
}

.card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  padding: 0.75rem;
}

body.dark-theme .card {
  background: #2d3748;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  padding-bottom: 0.375rem;
  border-bottom: 1px solid #eaeaea;
}

body.dark-theme .card-header {
  border-bottom-color: #4a5568;
}

.card-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #2d3748;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

body.dark-theme .card-title {
  color: #e2e8f0;
}

.card-title i {
  color: #fb7299;
}

.checkbox-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.checkbox-group input[type="checkbox"] {
  appearance: none;
  -webkit-appearance: none;
  width: 1.25rem;
  height: 1.25rem;
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
  left: 4px;
  top: 1px;
  width: 5px;
  height: 9px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.checkbox-group label {
  font-size: 0.875rem;
  color: #495057;
  cursor: pointer;
}

body.dark-theme .checkbox-group label {
  color: #cbd5e0;
}

.slider-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  display: block;
  font-weight: 500;
  font-size: 0.875rem;
  color: #495057;
}

body.dark-theme .form-label {
  color: #cbd5e0;
}

.volume-slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: #e9ecef;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

body.dark-theme .volume-slider {
  background: #4a5568;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: linear-gradient(135deg, #fb7299 0%, #fc8bab 100%);
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(251, 114, 153, 0.4);
}

.volume-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: linear-gradient(135deg, #fb7299 0%, #fc8bab 100%);
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 6px rgba(251, 114, 153, 0.4);
}

.slider-value {
  text-align: right;
  font-size: 0.875rem;
  color: #6c757d;
}

body.dark-theme .slider-value {
  color: #a0aec0;
}

.mt-4 {
  margin-top: 0.5rem;
}
</style>
