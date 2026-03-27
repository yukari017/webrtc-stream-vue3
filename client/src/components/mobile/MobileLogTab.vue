<template>
  <div class="mobile-log-tab">
    <div class="log-header">
      <h3 class="log-title">状态日志</h3>
      <button class="btn btn-secondary btn-sm" @click="clearLog">
        <i class="fas fa-trash"></i>
        清空
      </button>
    </div>
    
    <div class="log-content" ref="logContainer">
      <div
        v-for="(log, index) in logs"
        :key="log.timestamp + '-' + index"
        class="log-entry"
        :class="`log-${log.type}`"
      >
        <span class="log-time">{{ log.timestamp }}</span>
        <span class="log-message">{{ log.message }}</span>
      </div>
      <div v-if="logs.length === 0" class="log-empty">
        <i class="fas fa-clipboard-list fa-2x mb-2"></i>
        <p>暂无状态日志</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useWebRTCStore } from '@/stores'

const store = useWebRTCStore()
const logContainer = ref<HTMLDivElement | null>(null)

const logs = computed(() => store.statusLog)

const clearLog = () => {
  store.clearStatus()
}

watch(() => logs.value.length, () => {
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  })
})
</script>

<style scoped>
.mobile-log-tab {
  position: fixed;
  top: 56px;
  left: 0;
  right: 0;
  bottom: 56px;
  display: flex;
  flex-direction: column;
  background: #fff;
}

body.dark-theme .mobile-log-tab {
  background: #2d3748;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e2e8f0;
  background: #f8f9fa;
}

body.dark-theme .log-header {
  background: #4a5568;
  border-bottom-color: #4a5568;
}

.log-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #2d3748;
}

body.dark-theme .log-title {
  color: #e2e8f0;
}

.log-content {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
  font-family: monospace;
  font-size: 0.8125rem;
}

.log-entry {
  padding: 0.5rem 0;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

body.dark-theme .log-entry {
  border-bottom-color: #4a5568;
}

.log-time {
  color: #6c757d;
  font-size: 0.6875rem;
}

body.dark-theme .log-time {
  color: #a0aec0;
}

.log-message {
  color: #2d3748;
  word-break: break-word;
}

body.dark-theme .log-message {
  color: #e2e8f0;
}

.log-info .log-message {
  color: #0ea5e9;
}

.log-warning .log-message {
  color: #f59e0b;
}

.log-error .log-message {
  color: #ef4444;
}

.log-success .log-message {
  color: #10b981;
  font-weight: 500;
}

body.dark-theme .log-info .log-message {
  color: #63b3ed;
}

body.dark-theme .log-warning .log-message {
  color: #f6ad55;
}

body.dark-theme .log-error .log-message {
  color: #fc8181;
}

body.dark-theme .log-success .log-message {
  color: #68d391;
}

.log-empty {
  text-align: center;
  padding: 3rem 1rem;
  color: #9ca3af;
}

.log-empty i {
  opacity: 0.5;
  margin-bottom: 0.5rem;
}

.log-empty p {
  margin: 0;
  font-size: 0.875rem;
}

.btn {
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 0.75rem;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  transition: all 0.2s;
  font-weight: 500;
}

.btn-secondary {
  background: linear-gradient(135deg, #7dd3fc 0%, #bae6fd 100%);
  color: #0f172a;
}

.btn-secondary:active {
  transform: scale(0.95);
}

.mb-2 {
  margin-bottom: 0.5rem;
}

.fa-2x {
  font-size: 1.5rem;
}
</style>
