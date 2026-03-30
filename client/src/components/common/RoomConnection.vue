<template>
  <div class="card room-connection-card" :class="[$attrs.class]">
    <div class="card-header">
      <h3 class="card-title">房间连接</h3>
    </div>

    <div class="form-group">
      <label :for="inputId" class="form-label">房间号</label>
      <div class="input-group">
        <input
          :id="inputId"
          :name="inputName"
          type="text"
          class="form-control"
          :value="modelValue"
          @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value.toUpperCase())"
          :placeholder="placeholder"
          :readonly="readonly"
          :disabled="disabled"
          @keyup.enter="$emit('submit')"
        />
        <button
          v-if="showGenerate"
          class="btn btn-secondary"
          @click="$emit('generate')"
          :title="generateTitle"
          :disabled="generateDisabled"
        >
          <i class="fas fa-random"></i>
          <span class="btn-text">生成</span>
        </button>
        <button
          v-if="showClear"
          class="btn btn-secondary"
          @click="$emit('clear')"
          title="清空房间号"
        >
          <i class="fas fa-trash"></i>
          <span class="btn-text">清空</span>
        </button>
        <button
          v-if="showCopy"
          class="btn btn-success"
          @click="$emit('copy')"
          title="复制房间号"
          :disabled="copyDisabled"
        >
          <i class="fas fa-copy"></i>
          <span class="btn-text">复制</span>
        </button>
        <button
          v-if="showJoin"
          class="btn btn-success"
          @click="$emit('submit')"
          :disabled="joinDisabled"
        >
          <i class="fas fa-sign-in-alt"></i>
          <span class="btn-text">{{ joinText }}</span>
        </button>
      </div>
    </div>

    <div class="connection-info" v-if="showConnectionInfo && isConnected">
      <div class="info-item">
        <i class="fas fa-door-open"></i>
        <span>房间: {{ modelValue }}</span>
      </div>
      <div class="info-item" v-if="clientId">
        <i class="fas fa-id-card"></i>
        <span>你的ID: {{ clientId }}</span>
      </div>
    </div>

    <div class="connection-controls" v-if="showLeave">
      <button
        class="btn btn-danger w-100"
        @click="$emit('leave')"
        :disabled="!isConnected"
      >
        <i class="fas fa-sign-out-alt"></i>
        离开房间
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({
  inheritAttrs: false
})

defineProps<{
  modelValue: string
  inputId: string
  inputName: string
  placeholder?: string
  readonly?: boolean
  disabled?: boolean

  // 按钮控制
  showGenerate?: boolean
  showClear?: boolean
  showCopy?: boolean
  showJoin?: boolean
  showLeave?: boolean
  showConnectionInfo?: boolean

  // 按钮状态
  generateTitle?: string
  generateDisabled?: boolean
  copyDisabled?: boolean
  joinDisabled?: boolean
  joinText?: string

  // 连接状态
  isConnected?: boolean
  clientId?: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
  'generate': []
  'clear': []
  'copy': []
  'submit': []
  'leave': []
}>()
</script>

<style scoped>
/* 房间连接卡片特有样式 - 公共样式见 components.css */

.room-connection-card {
  container-type: inline-size;
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 1.5rem;
}

body.dark-theme .room-connection-card {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-color);
}

.card-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
}

/* 连接信息 */
.connection-info {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: 1rem;
  margin-top: 1rem;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.info-item:last-child {
  margin-bottom: 0;
}

.info-item i {
  color: var(--primary);
}

/* 连接控制 */
.connection-controls {
  margin-top: 1rem;
}

.w-100 {
  width: 100%;
}

/* 响应式显示控制 */
.room-connection-mobile {
  display: block;
}

.room-connection-desktop {
  display: none;
}

@media (min-width: 1025px) {
  .room-connection-mobile {
    display: none;
  }

  .room-connection-desktop {
    display: block;
  }
}

/* input-group 内的按钮：固定尺寸，不随容器压缩 */
.input-group .btn {
  flex-shrink: 0;
  padding: 0.5rem 0.875rem;
  font-size: 0.875rem;
  white-space: nowrap;
}

/* 输入框：字体缩小，flex:1 撑满剩余空间（不限 max-width） */
.input-group .form-control {
  font-size: 0.875rem;
  padding: 0.5rem 0.75rem;
}

/* 容器宽度不足时只保留图标，文字隐藏 */
@container (max-width: 280px) {
  .input-group .btn .btn-text {
    display: none;
  }
  .input-group .btn {
    padding: 0.5rem 0.625rem;
    gap: 0;
  }
}

/* 不支持 container query 的降级：用 media query 兜底 */
@media (max-width: 320px) {
  .input-group .btn .btn-text {
    display: none;
  }
  .input-group .btn {
    padding: 0.5rem 0.625rem;
    gap: 0;
  }
}
</style>
