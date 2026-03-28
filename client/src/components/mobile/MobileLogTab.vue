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
/* 移动端日志特有样式 - 公共样式见 components.css */

.mobile-log-tab {
  position: fixed;
  top: 56px;
  left: 0;
  right: 0;
  bottom: 56px;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.log-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
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
  border-bottom: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.log-time {
  color: var(--text-muted);
  font-size: 0.6875rem;
}

.log-message {
  color: var(--text-primary);
  word-break: break-word;
}

.log-info .log-message { color: var(--info); }
.log-warning .log-message { color: var(--warning); }
.log-error .log-message { color: var(--error); }
.log-success .log-message { color: var(--success); font-weight: 500; }

.log-empty {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-muted);
}

.log-empty i {
  opacity: 0.5;
  margin-bottom: 0.5rem;
}

.log-empty p {
  margin: 0;
  font-size: 0.875rem;
}

.mb-2 { margin-bottom: 0.5rem; }
.fa-2x { font-size: 1.5rem; }
</style>
