/**
 * 全局事件总线
 * 替代各 composable 内部分离的 globalListeners，
 * 保证所有模块使用同一个事件命名空间，避免内存泄漏。
 */

type Callback = (...args: unknown[]) => void

const listeners = new Map<string, Set<Callback>>()

export const eventBus = {
  /**
   * 订阅事件
   * @param event 事件名
   * @param callback 回调，**必须**在不用时通过 off() 取消订阅
   */
  on(event: string, callback: Callback): void {
    if (!listeners.has(event)) {
      listeners.set(event, new Set())
    }
    listeners.get(event)!.add(callback)
  },

  /**
   * 取消订阅（与 on 配对使用）
   */
  off(event: string, callback: Callback): void {
    listeners.get(event)?.delete(callback)
    if (listeners.get(event)?.size === 0) {
      listeners.delete(event)
    }
  },

  /**
   * 触发事件，**不**等待异步回调
   */
  emit(event: string, ...args: unknown[]): void {
    listeners.get(event)?.forEach(cb => {
      try {
        cb(...args)
      } catch (err) {
        console.error(`[eventBus] 事件 "${event}" 的回调抛出异常:`, err)
      }
    })
  },

  /** 清空所有监听器（仅供测试 / 全局清理使用） */
  reset(): void {
    listeners.clear()
  },

  /** 调试：当前订阅数量 */
  get size(): number {
    return listeners.size
  }
}
