/**
 * EventBus - 事件总线（TypeScript版本）
 */
import EventEmitter from 'eventemitter3';
import type { EventMap } from '../types';

class EventBus extends EventEmitter<EventMap> {
  /**
   * 订阅事件（类型安全）
   */
  on<K extends keyof EventMap>(
    event: K,
    callback: (data: EventMap[K]) => void
  ): this {
    return super.on(event, callback as any);
  }

  /**
   * 订阅事件（只触发一次）
   */
  once<K extends keyof EventMap>(
    event: K,
    callback: (data: EventMap[K]) => void
  ): this {
    return super.once(event, callback as any);
  }

  /**
   * 取消订阅
   */
  off<K extends keyof EventMap>(
    event: K,
    callback?: (data: EventMap[K]) => void
  ): this {
    return super.off(event, callback as any);
  }

  /**
   * 触发事件
   */
  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): boolean {
    return super.emit(event, data as any);
  }

  /**
   * 清除所有监听器
   */
  clear(): void {
    this.removeAllListeners();
  }

  /**
   * 清除指定事件的监听器
   */
  clearEvent<K extends keyof EventMap>(event: K): void {
    this.removeAllListeners(event);
  }
}

// 导出单例
export const eventBus = new EventBus();
export default EventBus;
