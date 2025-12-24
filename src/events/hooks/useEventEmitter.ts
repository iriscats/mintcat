/**
 * React hooks for event emitting
 * 提供 memoized 事件发射函数
 */

import { useCallback, useRef, useEffect } from 'react';
import { emitEvent, emitVoidEvent } from '../EventEmitter';
import type { EventName, EventPayload, VoidEventName } from '../EventRegistry';

/**
 * React hook for event emitting
 *
 * 返回一个 memoized 的事件发射函数
 * 适用于需要在 JSX 或其他 hooks 依赖中传递发射函数的场景
 *
 * @param event 事件名称
 * @returns memoized emit function
 *
 * @example
 * function MyComponent() {
 *   const emitError = useEventEmitter('app-error');
 *
 *   const handleClick = () => {
 *     emitError('发生错误');
 *   };
 *
 *   // emitError 函数引用在整个组件生命周期内保持稳定
 *   return <button onClick={handleClick}>Trigger Error</button>;
 * }
 *
 * @example
 * // 复杂 payload
 * function ModUpdater({ modId, modData }) {
 *   const emitModUpdate = useEventEmitter('mod-treeview-update');
 *
 *   useEffect(() => {
 *     emitModUpdate({ modId, data: modData });
 *   }, [modId, modData, emitModUpdate]);
 * }
 */
export function useEventEmitter<E extends EventName>(event: E) {
  return useCallback(
    async (payload: EventPayload<E>) => {
      try {
        await emitEvent(event, payload);
      } catch (error) {
        console.error(`[useEventEmitter] Failed to emit event "${event}":`, error);
      }
    },
    [event]
  );
}

/**
 * React hook for void event emitting
 *
 * 专门用于不需要 payload 的事件
 *
 * @param event 事件名称（must be void payload）
 * @returns memoized emit function
 *
 * @example
 * function TreeView() {
 *   const updateTreeView = useVoidEventEmitter('home-page-update-tree-view');
 *
 *   const handleRefresh = () => {
 *     updateTreeView();  // 无需传参
 *   };
 *
 *   return <button onClick={handleRefresh}>Refresh</button>;
 * }
 */
export function useVoidEventEmitter<E extends VoidEventName>(event: E) {
  return useCallback(async () => {
    try {
      await emitVoidEvent(event);
    } catch (error) {
      console.error(`[useVoidEventEmitter] Failed to emit void event "${event}":`, error);
    }
  }, [event]);
}

/**
 * React hook for controlled event emitting with loading state
 *
 * 返回一个带加载状态的事件发射函数
 * 适用于需要显示加载状态的异步操作
 *
 * @param event 事件名称
 * @returns [emit function, isLoading state]
 *
 * @example
 * function MyComponent() {
 *   const [emitUpdate, isLoading] = useEventEmitterWithLoading('mod-treeview-update');
 *
 *   const handleUpdate = async () => {
 *     await emitUpdate({ modId: 123, data: modData });
 *     // isLoading 会自动在 emit 期间设置为 true
 *   };
 *
 *   return (
 *     <button onClick={handleUpdate} disabled={isLoading}>
 *       {isLoading ? 'Updating...' : 'Update'}
 *     </button>
 *   );
 * }
 */
export function useEventEmitterWithLoading<E extends EventName>(
  event: E
): [
  (payload: EventPayload<E>) => Promise<void>,
  boolean
] {
  const [isLoading, setIsLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const emit = useCallback(
    async (payload: EventPayload<E>) => {
      setIsLoading(true);
      try {
        await emitEvent(event, payload);
      } catch (error) {
        console.error(`[useEventEmitterWithLoading] Failed to emit event "${event}":`, error);
        throw error;
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [event]
  );

  return [emit, isLoading];
}

// Import useState (missing from imports above)
import { useState } from 'react';

/**
 * React hook for batched event emitting
 *
 * 批量发射事件，避免短时间内多次发射同一事件
 * 使用防抖策略
 *
 * @param event 事件名称
 * @param delay 防抖延迟时间（ms）
 * @returns emit function
 *
 * @example
 * function SearchInput() {
 *   const emitSearch = useBatchedEventEmitter('search-query-changed', 300);
 *
 *   const handleChange = (e) => {
 *     // 300ms 内的多次调用会被合并
 *     emitSearch(e.target.value);
 *   };
 *
 *   return <input onChange={handleChange} />;
 * }
 */
export function useBatchedEventEmitter<E extends EventName>(
  event: E,
  delay: number = 300
) {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (payload: EventPayload<E>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(async () => {
        if (mountedRef.current) {
          try {
            await emitEvent(event, payload);
          } catch (error) {
            console.error(`[useBatchedEventEmitter] Failed to emit event "${event}":`, error);
          }
        }
      }, delay);
    },
    [event, delay]
  );
}
