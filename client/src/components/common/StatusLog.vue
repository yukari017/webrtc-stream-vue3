<template>
  <div class="card mt-4">
    <div class="card-header">
      <h3 class="card-title">状态日志</h3>
      <button class="btn btn-sm btn-secondary" @click="clearLog">
        <i class="fas fa-trash"></i>
        清空
      </button>
    </div>
    
    <div class="status-log">
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
        暂无状态日志
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useWebRTCStore } from '@/stores'

const store = useWebRTCStore()

const logs = computed(() => store.statusLog)

const clearLog = () => {
  store.clearStatus()
}
</script>

<style scoped>
/* 状态日志特有样式 - 公共样式见 components.css */

.status-log {
  max-height: 200px;
  overflow-y: auto;
  padding: 0.5rem;
  background: var(--bg-secondary);
  border-radius: 6px;
  font-family: monospace;
  font-size: 0.875rem;
}

body.dark-theme .status-log {
  color: var(--text-primary);
}

.log-entry {
  padding: 0.25rem 0;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
}

.log-time {
  color: var(--text-muted);
  margin-right: 0.5rem;
  font-size: 0.75rem;
  min-width: 8ch;
}

.log-message {
  flex: 1;
}

.log-info { color: var(--info); }
.log-warning { color: var(--warning); }
.log-error { color: var(--error); }
.log-success { color: var(--success); font-weight: 500; }

.log-empty {
  text-align: center;
  color: var(--text-muted);
  padding: 1rem;
  font-style: italic;
}
</style>
