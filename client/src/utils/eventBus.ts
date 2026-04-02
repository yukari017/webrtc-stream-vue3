/**
 * 类型安全的事件总线
 * 基于 EventMap 实现编译时类型检查
 */

import type { EventMap } from '@/types'

type EventKey = keyof EventMap
type EventCallback<T> = (data: T) => void

// 类型安全的事件映射
const listeners = new Map<EventKey, Set<EventCallback<unknown>>>()

// 不安全的事件映射（动态事件名）
const unsafeListeners = new Map<string, Set<(...args: unknown[]) => void>>()

export const eventBus = {
  /**
   * 订阅事件（类型安全版本）
   */
  on<K extends EventKey>(event: K, callback: EventCallback<EventMap[K]>): void {
    if (!listeners.has(event)) {
      listeners.set(event, new Set())
    }
    listeners.get(event)!.add(callback as EventCallback<unknown>)
  },

  /**
   * 订阅事件（类型不安全版本，用于动态事件名）
   */
  onUnsafe(event: string, callback: (...args: unknown[]) => void): void {
    if (!unsafeListeners.has(event)) {
      unsafeListeners.set(event, new Set())
    }
    unsafeListeners.get(event)!.add(callback)
  },

  /**
   * 取消订阅（类型安全版本）
   */
  off<K extends EventKey>(event: K, callback: EventCallback<EventMap[K]>): void {
    listeners.get(event)?.delete(callback as EventCallback<unknown>)
    if (listeners.get(event)?.size === 0) {
      listeners.delete(event)
    }
  },

  /**
   * 取消订阅（类型不安全版本）
   */
  offUnsafe(event: string, callback: (...args: unknown[]) => void): void {
    unsafeListeners.get(event)?.delete(callback)
    if (unsafeListeners.get(event)?.size === 0) {
      unsafeListeners.delete(event)
    }
  },

  /**
   * 触发事件（类型安全版本）
   */
  emit<K extends EventKey>(event: K, data: EventMap[K]): void {
    listeners.get(event)?.forEach(cb => {
      try {
        cb(data)
      } catch (err) {
        console.error(`[eventBus] 事件 "${event}" 的回调抛出异常:`, err)
      }
    })
  },

  /**
   * 触发事件（类型不安全版本，用于动态事件名）
   */
  emitUnsafe(event: string, ...args: unknown[]): void {
    unsafeListeners.get(event)?.forEach(cb => {
      try {
        cb(...args)
      } catch (err) {
        console.error(`[eventBus] 事件 "${event}" 的回调抛出异常:`, err)
      }
    })
  },

  /**
   * 清空所有监听器（仅供测试 / 全局清理使用）
   */
  reset(): void {
    listeners.clear()
    unsafeListeners.clear()
  },

  /**
   * 调试：当前订阅数量
   */
  get size(): number {
    return listeners.size + unsafeListeners.size
  },

  /**
   * 调试：获取某个事件的监听器数量
   */
  listenerCount(event: EventKey | string): number {
    return (listeners.get(event as EventKey)?.size ?? 0) + 
           (unsafeListeners.get(event)?.size ?? 0)
  }
}