/**
 * MintCat Event System
 * 类型安全的 Tauri 事件系统
 *
 * 使用方式：
 *
 * @example
 * // 导入单个函数
 * import { emitEvent, useEventListener } from '@/events';
 *
 * // 发射事件
 * await emitEvent('app-error', '发生错误');
 * await emitEvent('mod-treeview-update', { modId: 123, data: modData });
 *
 * // React 组件中使用 hooks
 * function MyComponent() {
 *   useEventListener('app-error', (msg) => {
 *     notification.error(msg);
 *   });
 * }
 *
 * @example
 * // 使用命名空间 API
 * import * as Events from '@/events';
 *
 * await Events.emitEvent('app-error', '错误');
 * Events.useEventListener('theme-change', handleThemeChange);
 */

// ========================================
// 类型导出
// ========================================

export type {
  EventName,
  EventPayload,
  EventPayloads,
  VoidEventName,
  NonVoidEventName,
  IsVoidPayload,
} from './EventRegistry';

// ========================================
// 事件发射
// ========================================

export {
  emitEvent,
  emitVoidEvent,
  emit,
  Events as EventEmitterAPI,
} from './EventEmitter';

// ========================================
// 事件监听
// ========================================

export {
  listenEvent,
  listenFiltered,
  onceEvent,
  Events as EventListenerAPI,
} from './EventListener';

// Re-export UnlistenFn from Tauri for convenience
export type { UnlistenFn, Event } from '@tauri-apps/api/event';

// ========================================
// React Hooks
// ========================================

export {
  useEventListener,
  useFilteredEventListener,
  useOnceEventListener,
  useEventCallback,
} from './hooks/useEventListener';

export {
  useEventEmitter,
  useVoidEventEmitter,
  useEventEmitterWithLoading,
  useBatchedEventEmitter,
} from './hooks/useEventEmitter';

// ========================================
// 调试工具
// ========================================

export {
  EventDebugger,
  enableEventDebugger,
  disableEventDebugger,
  getEventStats,
  clearEventStats,
  isEventDebuggerEnabled,
} from './EventDebugger';

// ========================================
// 便捷导出：统一的 API 对象
// ========================================

/**
 * 统一的事件 API
 *
 * 提供命名空间式的访问方式
 *
 * @example
 * import { Events } from '@/events';
 *
 * // 发射事件
 * await Events.emit('app-error', '错误');
 * await Events.emitVoid('home-page-update-tree-view');
 *
 * // 监听事件
 * const unlisten = await Events.listen('app-error', (msg) => {
 *   console.log(msg);
 * });
 *
 * // React hooks
 * Events.useListener('theme-change', handleThemeChange);
 * const emitError = Events.useEmitter('app-error');
 */
import { emitEvent as _emitEvent, emitVoidEvent as _emitVoidEvent } from './EventEmitter';
import { listenEvent as _listenEvent, listenFiltered as _listenFiltered } from './EventListener';
import {
  useEventListener as _useEventListener,
  useFilteredEventListener as _useFilteredEventListener,
} from './hooks/useEventListener';
import {
  useEventEmitter as _useEventEmitter,
  useVoidEventEmitter as _useVoidEventEmitter,
} from './hooks/useEventEmitter';

export const Events = {
  // Emitters
  emit: _emitEvent,
  emitVoid: _emitVoidEvent,

  // Listeners
  listen: _listenEvent,
  listenFiltered: _listenFiltered,

  // React Hooks
  useListener: _useEventListener,
  useFilteredListener: _useFilteredEventListener,
  useEmitter: _useEventEmitter,
  useVoidEmitter: _useVoidEventEmitter,
} as const;

// ========================================
// 默认导出：EventDebugger
// ========================================

export { EventDebugger as default } from './EventDebugger';
