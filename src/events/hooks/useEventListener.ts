/**
 * React hooks for event listening
 * 自动管理监听器生命周期，防止内存泄漏
 */

import { useEffect, useRef, useCallback } from 'react';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { listenEvent, listenFiltered, onceEvent } from '../EventListener';
import type { EventName, EventPayload } from '../EventRegistry';

/**
 * React hook for automatic event listener lifecycle management
 *
 * 关键功能：
 * - 组件挂载时自动设置监听器
 * - 组件卸载时自动清理监听器（防止内存泄漏）
 * - 依赖项变化时重新设置监听器
 * - 处理异步设置期间的组件卸载情况
 *
 * 使用此 hook 替代手动 listen() + cleanup 的模式！
 *
 * @param event 事件名称
 * @param callback 回调函数
 * @param dependencies 依赖数组（类似 useEffect）
 *
 * @example
 * // 简单用法
 * function MyComponent() {
 *   useEventListener('app-error', (message) => {
 *     notification.error(message);
 *   });
 *   // ✅ 自动清理，无内存泄漏
 * }
 *
 * @example
 * // 带依赖项
 * function ModComponent({ modId }) {
 *   useEventListener(
 *     'status-bar-log',
 *     (msg) => console.log(msg),
 *     [modId]  // modId 变化时重新设置监听器
 *   );
 * }
 *
 * @example
 * // 复杂 payload
 * function DownloadProgress() {
 *   useEventListener('download-api-progress', (progress) => {
 *     console.log(`${progress.downloadedSize} / ${progress.totalSize}`);
 *   });
 * }
 */
export function useEventListener<E extends EventName>(
  event: E,
  callback: (payload: EventPayload<E>) => void | Promise<void>,
  dependencies: any[] = []
) {
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const callbackRef = useRef(callback);

  // 始终使用最新的 callback
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    let mounted = true;

    const setupListener = async () => {
      try {
        // 使用 ref 中的 callback 避免闭包问题
        const unlisten = await listenEvent(event, (payload) => {
          return callbackRef.current(payload);
        });

        if (mounted) {
          unlistenRef.current = unlisten;
        } else {
          // 组件在监听器设置完成前卸载了，立即清理
          unlisten();
        }
      } catch (error) {
        console.error(`[useEventListener] Failed to setup listener for "${event}":`, error);
      }
    };

    setupListener();

    return () => {
      mounted = false;
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, [event, ...dependencies]);
}

/**
 * React hook for filtered event listening
 *
 * 关键用途：替代动态事件名！
 *
 * 旧模式（❌ 内存泄漏）：
 * ```typescript
 * function ModItem({ nodeData }) {
 *   listen("mod-treeview-update" + nodeData.key, handler).then();
 *   // ❌ 监听器从未清理！
 * }
 * ```
 *
 * 新模式（✅ 自动清理）：
 * ```typescript
 * function ModItem({ modId }) {
 *   useFilteredEventListener(
 *     'mod-treeview-update',
 *     (p) => p.modId === modId,  // 只处理该 mod
 *     (p) => setModData(p.data),
 *     [modId]
 *   );
 *   // ✅ 组件卸载时自动清理
 * }
 * ```
 *
 * @param event 事件名称
 * @param filter 过滤函数，返回 true 时调用 callback
 * @param callback 回调函数
 * @param dependencies 依赖数组
 *
 * @example
 * // 只监听特定 mod 的更新
 * function ModTreeViewItem({ modId }) {
 *   const [progress, setProgress] = useState(0);
 *
 *   useFilteredEventListener(
 *     'mod-treeview-update',
 *     (p) => p.modId === modId,
 *     (p) => {
 *       setProgress(p.data.download?.downloadProgress || 100);
 *     },
 *     [modId]
 *   );
 *
 *   return <Progress percent={progress} />;
 * }
 */
export function useFilteredEventListener<E extends EventName>(
  event: E,
  filter: (payload: EventPayload<E>) => boolean,
  callback: (payload: EventPayload<E>) => void | Promise<void>,
  dependencies: any[] = []
) {
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const callbackRef = useRef(callback);
  const filterRef = useRef(filter);

  // 始终使用最新的 callback 和 filter
  useEffect(() => {
    callbackRef.current = callback;
    filterRef.current = filter;
  });

  useEffect(() => {
    let mounted = true;

    const setupListener = async () => {
      try {
        const unlisten = await listenFiltered(
          event,
          (payload) => filterRef.current(payload),
          (payload) => callbackRef.current(payload)
        );

        if (mounted) {
          unlistenRef.current = unlisten;
        } else {
          unlisten();
        }
      } catch (error) {
        console.error(`[useFilteredEventListener] Failed to setup filtered listener for "${event}":`, error);
      }
    };

    setupListener();

    return () => {
      mounted = false;
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, [event, ...dependencies]);
}

/**
 * React hook for one-time event listening
 *
 * 事件触发一次后自动取消监听
 *
 * @example
 * function InstallButton() {
 *   useOnceEventListener('install-success', (timestamp) => {
 *     notification.success('安装完成！');
 *   });
 * }
 */
export function useOnceEventListener<E extends EventName>(
  event: E,
  callback: (payload: EventPayload<E>) => void | Promise<void>,
  dependencies: any[] = []
) {
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    let mounted = true;

    const setupListener = async () => {
      try {
        const unlisten = await onceEvent(event, (payload) => {
          return callbackRef.current(payload);
        });

        if (mounted) {
          unlistenRef.current = unlisten;
        } else {
          unlisten();
        }
      } catch (error) {
        console.error(`[useOnceEventListener] Failed to setup once listener for "${event}":`, error);
      }
    };

    setupListener();

    return () => {
      mounted = false;
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, [event, ...dependencies]);
}

/**
 * Hook to create a memoized event callback
 *
 * 用于获取一个稳定的事件监听回调函数引用
 * 适用于需要在多个地方使用同一个回调的场景
 *
 * @example
 * function MyComponent() {
 *   const handleError = useEventCallback<'app-error'>((message) => {
 *     console.error('Error:', message);
 *   });
 *
 *   // handleError 在整个组件生命周期内保持稳定
 *   useEventListener('app-error', handleError);
 * }
 */
export function useEventCallback<E extends EventName>(
  callback: (payload: EventPayload<E>) => void | Promise<void>
) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  return useCallback((payload: EventPayload<E>) => {
    return callbackRef.current(payload);
  }, []);
}
