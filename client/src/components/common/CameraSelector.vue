<template>
  <div class="camera-selector">
    <label for="camera-select" class="form-label">选择摄像头</label>
    <select 
      id="camera-select"
      name="camera"
      class="form-control"
      v-model="selectedId"
      :disabled="disabled"
    >
      <option value="">选择摄像头</option>
      <option v-for="camera in devices" :key="camera.deviceId" :value="camera.deviceId">
        {{ camera.label || `摄像头 ${camera.deviceId.slice(0, 8)}` }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { isMobile } from '@/utils/ui-utils'

const props = defineProps<{
  modelValue: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const devices = ref<MediaDeviceInfo[]>([])
const selectedId = ref(props.modelValue)

watch(() => props.modelValue, (val) => {
  selectedId.value = val
})

watch(selectedId, (val) => {
  emit('update:modelValue', val)
})

onMounted(async () => {
  await loadCameras()
})

async function loadCameras() {
  let tempStream: MediaStream | null = null

  // 移动端先请求权限以获取带真实 label 的设备列表
  if (isMobile()) {
    try {
      tempStream = await navigator.mediaDevices.getUserMedia({ video: true })
    } catch {
      // 权限被拒也能继续
    }
  }

  try {
    const allDevices = await navigator.mediaDevices.enumerateDevices()
    devices.value = allDevices.filter(d => d.kind === 'videoinput')

    // 移动端默认选择后置摄像头
    if (isMobile() && devices.value.length > 0 && !selectedId.value) {
      const rearCamera = devices.value.find(c => {
        const label = (c.label || '').toLowerCase()
        return label.includes('back') || label.includes('rear') ||
               label.includes('后置') || label.includes('environment')
      })
      selectedId.value = rearCamera
        ? rearCamera.deviceId
        : devices.value[devices.value.length - 1].deviceId
    }
  } catch (error) {
    console.error('加载摄像头列表失败:', error)
  }

  if (tempStream) {
    tempStream.getTracks().forEach(t => t.stop())
  }
}

// 暴露刷新方法，供父组件调用
defineExpose({ refresh: loadCameras })
</script>

<style scoped>
.camera-selector {
  width: 100%;
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
</style>
