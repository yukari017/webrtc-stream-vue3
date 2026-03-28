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

/* 卡片、表单、按钮样式已在全局 mobile-common.css 和 components.css 中定义 */

.card-title i {
  color: #fb7299;
}

.slider-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.slider-value {
  text-align: right;
  font-size: 0.875rem;
  color: #6c757d;
}

body.dark-theme .slider-value {
  color: #a0aec0;
}
</style>
