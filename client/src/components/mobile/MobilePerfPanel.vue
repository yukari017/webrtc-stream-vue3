<template>
  <div class="perf-panel" v-if="show">
    <div class="perf-grid">
      <div class="perf-item">
        <div class="perf-label">比特率</div>
        <div class="perf-value">{{ formatBitrate(data.bitrate) }}</div>
      </div>
      <div class="perf-item">
        <div class="perf-label">分辨率</div>
        <div class="perf-value">{{ formatResolution(data.resolution) }}</div>
      </div>
      <div class="perf-item">
        <div class="perf-label">帧率</div>
        <div class="perf-value">{{ data.framerate || '0' }}</div>
      </div>
      <div class="perf-item">
        <div class="perf-label">延迟</div>
        <div class="perf-value">{{ data.rtt || '0' }}</div>
      </div>
      <div class="perf-item">
        <div class="perf-label">丢包</div>
        <div class="perf-value">{{ data.packetLoss || '0' }}%</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface PerfData {
  bitrate?: number | string
  resolution?: string
  framerate?: number | string
  rtt?: number | string
  packetLoss?: number | string
}

const props = defineProps<{
  show: boolean
  data: PerfData
}>()

const formatBitrate = (bitrate: number | string | undefined): string => {
  if (!bitrate || bitrate === '0' || bitrate === 0) return '0'
  return `${bitrate}`
}

const formatResolution = (resolution: string | undefined): string => {
  if (!resolution || resolution === '0×0' || resolution === '0x0') return '0p'
  
  // 如果已经是简化格式(如 1080p)，直接返回
  if (resolution.endsWith('p')) return resolution
  
  // 解析分辨率，如 "1920×1080" -> "1080p"
  const match = resolution.match(/(\d+)[×x](\d+)/)
  if (match) {
    const height = parseInt(match[2], 10)
    return `${height}p`
  }
  return resolution
}
</script>

<style scoped>
.perf-panel {
  padding: 0.5rem;
  background: #f8f9fa;
  border-radius: 6px;
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
  padding: 0.25rem;
  min-width: 0;
  flex: 1;
}

.perf-label {
  font-size: 0.625rem;
  color: #6c757d;
  margin-bottom: 0.125rem;
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
</style>
