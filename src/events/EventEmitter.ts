/**
 * 类型安全的事件发射器
 * 封装 Tauri 的 emit API，提供 TypeScript 类型检查
 */

import { emit as tauriEmit } from '@tauri-apps/api/event';
import type { EventName, EventPayload, VoidEventName, NonVoidEventName } from './EventRegistry';

/**
 * 发射带 payload 的事件
 *
 * 编译时确保：
 * 1. 事件名称必须在 EventRegistry 中定义
 * 2. payload 类型必须匹配事件定义
 *
 * @example
 * // ✅ 正确：类型匹配
 * await emitEvent('app-error', '发生错误');
 * await emitEvent('mod-treeview-update', { modId: 123, data: modData });
 *
 * // ❌ 错误：类型不匹配，编译失败
 * await emitEvent('app-error', 123);  // 期望 string，得到 number
 * await emitEvent('mod-treeview-update', modData);  // 缺少 modId 字段
 */
export async function emitEvent<E extends EventName>(
  event: E,
  payload: EventPayload<E>
): Promise<void> {
  try {
    await tauriEmit(event, payload);
  } catch (error) {
    console.error(`[EventEmitter] Failed to emit event "${event}":`, error);
    throw error;
  }
}

/**
 * 发射不带 payload 的事件 (void payload)
 *
 * 专门用于 payload 类型为 void 的事件
 * 调用时无需传递 payload 参数
 *
 * @example
 * // ✅ 正确：void 事件无需 payload
 * await emitVoidEvent('home-page-update-tree-view');
 * await emitVoidEvent('tree-view-count-label-update');
 *
 * // ❌ 错误：不能对非 void 事件使用
 * await emitVoidEvent('app-error');  // 编译失败：app-error 需要 string payload
 */
export async function emitVoidEvent<E extends VoidEventName>(event: E): Promise<void> {
  try {
    await tauriEmit(event);
  } catch (error) {
    console.error(`[EventEmitter] Failed to emit void event "${event}":`, error);
    throw error;
  }
}

/**
 * 智能发射事件
 *
 * 自动判断事件是否需要 payload：
 * - 如果 payload 是 void，调用 emitVoidEvent
 * - 如果 payload 有值，调用 emitEvent
 *
 * 注意：此函数的类型推断可能不如直接使用 emitEvent/emitVoidEvent 精确
 * 建议优先使用 emitEvent 或 emitVoidEvent
 *
 * @example
 * await emit('app-error', '错误消息');
 * await emit('home-page-update-tree-view');
 */
export async function emit<E extends EventName>(
  event: E,
  ...args: EventPayload<E> extends void ? [] : [EventPayload<E>]
): Promise<void> {
  try {
    if (args.length === 0) {
      await tauriEmit(event);
    } else {
      await tauriEmit(event, args[0]);
    }
  } catch (error) {
    console.error(`[EventEmitter] Failed to emit event "${event}":`, error);
    throw error;
  }
}

/**
 * 便捷导出对象
 * 提供命名空间式的 API
 *
 * @example
 * import { Events } from '@/events';
 *
 * await Events.emit('app-error', '错误');
 * await Events.emitVoid('home-page-update-tree-view');
 */
export const Events = {
  /**
   * 发射事件（带 payload）
   */
  emit: emitEvent,

  /**
   * 发射事件（无 payload）
   */
  emitVoid: emitVoidEvent,

  /**
   * 智能发射事件
   */
  emitAuto: emit,
} as const;
