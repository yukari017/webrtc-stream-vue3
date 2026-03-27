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
.card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
  padding: 1.5rem;
}

body.dark-theme .card {
  background: #2d3748;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #eaeaea;
}

body.dark-theme .card-header {
  border-bottom: 1px solid #4a5568;
}

.card-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #2d3748;
}

body.dark-theme .card-title {
  color: #e2e8f0;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.2s;
  line-height: 1;
}

.btn i {
  line-height: 1;
  display: inline-block;
  vertical-align: middle;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
}

.btn-secondary {
  background: linear-gradient(135deg, #7dd3fc 0%, #bae6fd 100%);
  color: #0f172a;
}

.btn-secondary:hover:not(:disabled) {
  background: linear-gradient(135deg, #bae6fd 0%, #7dd3fc 100%);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(125, 211, 252, 0.4);
}

body.dark-theme .btn-secondary {
  background: linear-gradient(135deg, #7dd3fc 0%, #bae6fd 100%);
  color: #0f172a;
}

body.dark-theme .btn-secondary:hover:not(:disabled) {
  background: linear-gradient(135deg, #bae6fd 0%, #7dd3fc 100%);
}

.status-log {
  max-height: 200px;
  overflow-y: auto;
  padding: 0.5rem;
  background: #f8f9fa;
  border-radius: 6px;
  font-family: monospace;
  font-size: 0.875rem;
}

body.dark-theme .status-log {
  background: #4a5568;
  color: #e2e8f0;
}

.log-entry {
  padding: 0.25rem 0;
  border-bottom: 1px solid #eee;
  display: flex;
  align-items: center;
}

body.dark-theme .log-entry {
  border-bottom: 1px solid #718096;
}

.log-time {
  color: #6c757d;
  margin-right: 0.5rem;
  font-size: 0.75rem;
  min-width: 8ch;
}

body.dark-theme .log-time {
  color: #a0aec0;
}

.log-message {
  flex: 1;
}

.log-info {
  color: #7dd3fc;
}

.log-warning {
  color: #f6ad55;
}

.log-error {
  color: #fb7299;
}

.log-success {
  color: #0ea5e9;
  font-weight: 500;
}

.log-empty {
  text-align: center;
  color: #6c757d;
  padding: 1rem;
  font-style: italic;
}

body.dark-theme .log-empty {
  color: #a0aec0;
}

body.dark-theme .log-info {
  color: #63b3ed;
}

body.dark-theme .log-warning {
  color: #f6ad55;
}

body.dark-theme .log-error {
  color: #fc8181;
}

body.dark-theme .log-success {
  color: #68d391;
}
</style>
