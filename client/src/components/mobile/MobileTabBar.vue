<template>
  <nav class="mobile-tab-bar">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      :class="['tab-item', { active: modelValue === tab.id }]"
      @click="$emit('update:modelValue', tab.id)"
    >
      <div class="tab-icon-wrapper">
        <svg v-if="tab.iconType === 'svg'" class="tab-icon" viewBox="0 0 24 24" fill="currentColor">
          <path :d="tab.svgPath" />
        </svg>
        <i v-else :class="tab.icon"></i>
        <span v-if="tab.badge && tab.badge > 0" class="tab-badge">{{ tab.badge > 99 ? '99+' : tab.badge }}</span>
      </div>
      <span class="tab-label">{{ tab.label }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type TabId = 'stream' | 'settings' | 'chat' | 'log'

const props = defineProps<{
  modelValue: TabId
  unreadCount?: number
  mode?: 'stream' | 'view'
}>()

defineEmits<{
  'update:modelValue': [value: TabId]
}>()

// SVG 图标路径
const SVG_PATHS = {
  settings: 'M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z',
  comment: 'M20,2H4C2.9,2,2.01,2.9,2.01,4L2,22l4-4h14c1.1,0,2-0.9,2-2V4C22,2.9,21.1,2,20,2z M18,14H6v-2h12V14z M18,11H6V9 h12V11z M18,8H6V6h12V8z',
  listAlt: 'M19,5H5C3.9,5,3,5.9,3,7v10c0,1.1,0.9,2,2,2h14c1.1,0,2-0.9,2-2V7C21,5.9,20.1,5,19,5z M7,17H5v-2h2V17z M7,13H5 v-2h2V13z M7,9H5V7h2V9z M19,17H9v-2h10V17z M19,13H9v-2h10V13z M19,9H9V7h10V9z'
}

const tabs = computed(() => [
  { id: 'stream' as const, label: props.mode === 'view' ? '观看' : '推流', icon: props.mode === 'view' ? 'fas fa-eye' : 'fas fa-video', iconType: 'font', badge: 0 },
  { id: 'settings' as const, label: '设置', icon: '', iconType: 'svg', svgPath: SVG_PATHS.settings, badge: 0 },
  { id: 'chat' as const, label: '聊天', icon: '', iconType: 'svg', svgPath: SVG_PATHS.comment, badge: props.unreadCount || 0 },
  { id: 'log' as const, label: '日志', icon: '', iconType: 'svg', svgPath: SVG_PATHS.listAlt, badge: 0 }
])
</script>

<style scoped>
.mobile-tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 56px;
  background: #fff;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-around;
  align-items: center;
  z-index: 1000;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
}

body.dark-theme .mobile-tab-bar {
  background: #2d3748;
  border-top-color: #4a5568;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.2);
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 0;
  background: transparent;
  border: none;
  cursor: pointer;
  color: #6c757d;
  transition: all 0.2s ease;
  min-height: 56px;
}

body.dark-theme .tab-item {
  color: #a0aec0;
}

.tab-item:active {
  transform: scale(0.95);
}

.tab-item.active {
  color: #fb7299;
}

body.dark-theme .tab-item.active {
  color: #fc8bab;
}

.tab-icon-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}

.tab-item i,
.tab-icon {
  font-size: 1.25rem;
  width: 1.25rem;
  height: 1.25rem;
  transition: transform 0.2s ease;
}

.tab-icon {
  display: block;
}

.tab-item.active i,
.tab-item.active .tab-icon {
  transform: scale(1.1);
}

.tab-badge {
  position: absolute;
  top: -6px;
  right: -10px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background: linear-gradient(135deg, #fb7299 0%, #fc8bab 100%);
  color: white;
  font-size: 0.625rem;
  font-weight: 600;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(251, 114, 153, 0.3);
}

.tab-label {
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1;
}

.tab-item.active .tab-label {
  font-weight: 600;
}
</style>
