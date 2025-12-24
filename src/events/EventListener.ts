/**
 * 类型安全的事件监听器
 * 封装 Tauri 的 listen API，提供 TypeScript 类型检查
 */

import { listen as tauriListen, once as tauriOnce, type Event, type UnlistenFn } from '@tauri-apps/api/event';
import type { EventName, EventPayload } from './EventRegistry';

/**
 * 监听事件
 *
 * 编译时确保：
 * 1. 事件名称必须在 EventRegistry 中定义
 * 2. 回调函数的 payload 参数类型正确
 *
 * 重要：记得在不需要时调用返回的 unlisten 函数清理监听器！
 * 建议使用 React hooks (useEventListener) 自动管理清理
 *
 * @returns unlisten 函数，调用以取消监听
 *
 * @example
 * // ✅ 正确：payload 类型自动推断
 * const unlisten = await listenEvent('app-error', (message) => {
 *   console.log('错误:', message);  // message 类型为 string
 * });
 *
 * // 清理监听器
 * unlisten();
 *
 * @example
 * // ✅ 正确：复杂 payload 类型
 * const unlisten = await listenEvent('mod-treeview-update', (payload) => {
 *   console.log('Mod ID:', payload.modId);  // payload.modId 类型为 number
 *   console.log('Mod Data:', payload.data);  // payload.data 类型为 CompleteModData
 * });
 */
export async function listenEvent<E extends EventName>(
  event: E,
  callback: (payload: EventPayload<E>) => void | Promise<void>
): Promise<UnlistenFn> {
  try {
    return await tauriListen<EventPayload<E>>(event, async (tauriEvent: Event<EventPayload<E>>) => {
      try {
        await callback(tauriEvent.payload);
      } catch (error) {
        console.error(`[EventListener] Error in callback for event "${event}":`, error);
      }
    });
  } catch (error) {
    console.error(`[EventListener] Failed to setup listener for event "${event}":`, error);
    throw error;
  }
}

/**
 * 过滤监听器
 *
 * 关键功能：用于替代动态事件名！
 *
 * 旧的动态事件名模式：
 * ```typescript
 * // ❌ 问题：每个 modId 都创建一个新的事件通道
 * listen("mod-treeview-update" + modId, handler)
 * ```
 *
 * 新的过滤监听器模式：
 * ```typescript
 * // ✅ 解决方案：单一事件 + 过滤器
 * listenFiltered(
 *   'mod-treeview-update',
 *   (payload) => payload.modId === myModId,  // 只处理特定 modId
 *   (payload) => handleUpdate(payload.data)
 * )
 * ```
 *
 * 优势：
 * - 消除无限事件名
 * - 单一事件通道，性能更好
 * - 类型安全
 * - 易于调试
 *
 * @param event 事件名称
 * @param filter 过滤函数，返回 true 时调用 callback
 * @param callback 回调函数
 * @returns unlisten 函数
 *
 * @example
 * // 只监听 modId === 123 的更新
 * const unlisten = await listenFiltered(
 *   'mod-treeview-update',
 *   (p) => p.modId === 123,
 *   (p) => {
 *     console.log('Mod 123 updated:', p.data);
 *   }
 * );
 */
export async function listenFiltered<E extends EventName>(
  event: E,
  filter: (payload: EventPayload<E>) => boolean,
  callback: (payload: EventPayload<E>) => void | Promise<void>
): Promise<UnlistenFn> {
  try {
    return await tauriListen<EventPayload<E>>(event, async (tauriEvent: Event<EventPayload<E>>) => {
      try {
        // 应用过滤器
        if (filter(tauriEvent.payload)) {
          await callback(tauriEvent.payload);
        }
      } catch (error) {
        console.error(`[EventListener] Error in filtered callback for event "${event}":`, error);
      }
    });
  } catch (error) {
    console.error(`[EventListener] Failed to setup filtered listener for event "${event}":`, error);
    throw error;
  }
}

/**
 * 一次性监听事件
 *
 * 事件触发一次后自动取消监听
 *
 * @example
 * // 等待安装完成
 * await onceEvent('install-success', (timestamp) => {
 *   console.log('安装完成于:', new Date(timestamp));
 * });
 */
export async function onceEvent<E extends EventName>(
  event: E,
  callback: (payload: EventPayload<E>) => void | Promise<void>
): Promise<UnlistenFn> {
  try {
    return await tauriOnce<EventPayload<E>>(event, async (tauriEvent: Event<EventPayload<E>>) => {
      try {
        await callback(tauriEvent.payload);
      } catch (error) {
        console.error(`[EventListener] Error in once callback for event "${event}":`, error);
      }
    });
  } catch (error) {
    console.error(`[EventListener] Failed to setup once listener for event "${event}":`, error);
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
 * const unlisten = await Events.listen('app-error', (msg) => {
 *   console.log(msg);
 * });
 *
 * const unlistenFiltered = await Events.listenFiltered(
 *   'mod-treeview-update',
 *   (p) => p.modId === 123,
 *   (p) => handleUpdate(p.data)
 * );
 */
export const Events = {
  /**
   * 监听事件
   */
  listen: listenEvent,

  /**
   * 过滤监听器
   */
  listenFiltered,

  /**
   * 一次性监听
   */
  once: onceEvent,
} as const;
