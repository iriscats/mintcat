/**
 * Event Debugger
 * 开发模式下的事件调试工具
 * 在控制台实时显示所有事件的发射和接收
 */

import { listenEvent } from './EventListener';
import type { EventName, EventPayloads } from './EventRegistry';
import { IoC } from '@/core/IoC.ts';

/**
 * 事件统计信息
 */
interface EventStats {
  /** 事件名称 */
  name: EventName;
  /** 触发次数 */
  count: number;
  /** 最后触发时间 */
  lastTriggered: Date;
  /** 最后的 payload */
  lastPayload: any;
}

/**
 * 调试器配置
 */
interface DebuggerConfig {
  /** 是否在控制台输出日志 */
  consoleLog: boolean;
  /** 是否显示 payload */
  showPayload: boolean;
  /** 是否收集统计信息 */
  collectStats: boolean;
  /** 过滤器：只调试匹配的事件名 */
  filter?: (eventName: EventName) => boolean;
}

/**
 * 事件调试器
 *
 * 功能：
 * - 实时监控所有事件
 * - 在控制台输出事件日志
 * - 收集事件统计信息
 * - 支持事件过滤
 * - 支持暂停/恢复调试
 */
export class EventDebugger {
  private listeners = new Map<EventName, () => void>();
  private stats = new Map<EventName, EventStats>();
  private enabled = false;
  private config: DebuggerConfig = {
    consoleLog: true,
    showPayload: true,
    collectStats: true,
  };

  constructor() {}

  /**
   * 启用事件调试
   *
   * 开始监听所有已定义的事件
   * 只在开发模式下工作
   *
   * @param config 调试器配置
   *
   * @example
   * // 在 main.tsx 中启用
   * if (import.meta.env.DEV) {
   *   EventDebugger.enable();
   * }
   *
   * @example
   * // 只调试特定事件
   * EventDebugger.enable({
   *   filter: (name) => name.startsWith('mod-')
   * });
   */
  async enable(config?: Partial<DebuggerConfig>): Promise<void> {
    if (this.enabled) {
      console.warn('[EventDebugger] Already enabled');
      return;
    }

    // 只在开发模式下启用
    if (!import.meta.env.DEV) {
      console.warn('[EventDebugger] Only available in development mode');
      return;
    }

    // 更新配置
    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.enabled = true;
    console.log(
      '%c[EventDebugger] 🎯 Event debugging enabled',
      'color: #10b981; font-weight: bold;'
    );

    // 获取所有事件名称
    const allEvents = this.getAllEventNames();

    // 为每个事件设置监听器
    for (const event of allEvents) {
      // 应用过滤器
      if (this.config.filter && !this.config.filter(event)) {
        continue;
      }

      try {
        const unlisten = await listenEvent(event, (payload) => {
          this.handleEvent(event, payload);
        });
        this.listeners.set(event, unlisten);
      } catch (error) {
        console.error(`[EventDebugger] Failed to setup listener for "${event}":`, error);
      }
    }

    console.log(
      `[EventDebugger] Monitoring ${this.listeners.size} events`
    );
  }

  disable(): void {
    if (!this.enabled) {
      return;
    }

    // 移除所有监听器
    this.listeners.forEach((unlisten) => unlisten());
    this.listeners.clear();

    this.enabled = false;
    console.log('[EventDebugger] Event debugging disabled');
  }

  private handleEvent(event: EventName, payload: any): void {
    // 更新统计信息
    if (this.config.collectStats) {
      const stat = this.stats.get(event);
      if (stat) {
        stat.count++;
        stat.lastTriggered = new Date();
        stat.lastPayload = payload;
      } else {
        this.stats.set(event, {
          name: event,
          count: 1,
          lastTriggered: new Date(),
          lastPayload: payload,
        });
      }
    }

    // 控制台输出
    if (this.config.consoleLog) {
      const timestamp = new Date().toLocaleTimeString();
      const stat = this.stats.get(event);
      const count = stat ? `#${stat.count}` : '';

      if (this.config.showPayload) {
        console.log(
          `%c[Event] %c${timestamp} %c📡 ${event} ${count}`,
          'color: #3b82f6; font-weight: bold;',
          'color: #6b7280;',
          'color: #10b981;',
          payload
        );
      } else {
        console.log(
          `%c[Event] %c${timestamp} %c📡 ${event} ${count}`,
          'color: #3b82f6; font-weight: bold;',
          'color: #6b7280;',
          'color: #10b981;'
        );
      }
    }
  }

  getStats(): EventStats[] {
    return Array.from(this.stats.values()).sort((a, b) => b.count - a.count);
  }

  clearStats(): void {
    this.stats.clear();
    console.log('[EventDebugger] Statistics cleared');
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 获取所有已定义的事件名称
   */
  private getAllEventNames(): EventName[] {
    // 从 EventPayloads 接口提取所有事件名
    // 这是一个类型级别的操作，在运行时我们需要手动列出
    return [
      // 应用级事件
      'app-error',
      'theme-change',
      'user-info-load-success',
      'game-info-load-success',

      // UI 更新事件
      'home-page-update-tree-view',
      'home-page-update-profile-select',
      'home-page-loading',
      'tree-view-count-label-update',

      // 状态栏事件
      'status-bar-log',
      'status-bar-percent',

      // 对话框事件
      'config-manage-dialog-open',
      'title-bar-load-avatar',
      'add-mod-dialog-init-data',
      'add-mod-dialog-ok',
      'add-mod-dialog-close',
      'login-dialog-open',

      // 下载事件
      'download-api-progress',
      'download-api-status',

      // Mod 更新事件
      'mod-treeview-update',

      // 安装事件
      'install-success',
      'install-error',

      // 任务队列事件
      'task-updated',
      'task-type-registered',
      'task-type-updated',
      'task-type-unregistered',
      'frontend-task-start',

      // Tauri 内部事件
      'tauri://file-drop',
    ] as EventName[];
  }
}

/**
 * 便捷导出函数
 */
export const enableEventDebugger = async (config?: Partial<DebuggerConfig>): Promise<void> => {
  const debuggerInstance = await IoC.get(EventDebugger);
  await debuggerInstance.enable(config);
};

export const disableEventDebugger = async (): Promise<void> => {
  const debuggerInstance = await IoC.get(EventDebugger);
  debuggerInstance.disable();
};

export const getEventStats = async (): Promise<EventStats[]> => {
  const debuggerInstance = await IoC.get(EventDebugger);
  return debuggerInstance.getStats();
};

export const clearEventStats = async (): Promise<void> => {
  const debuggerInstance = await IoC.get(EventDebugger);
  debuggerInstance.clearStats();
};

export const isEventDebuggerEnabled = async (): Promise<boolean> => {
  const debuggerInstance = await IoC.get(EventDebugger);
  return debuggerInstance.isEnabled();
};

/**
 * 开发工具：在控制台提供全局访问
 *
 * 使用方式：
 * 1. 打开浏览器控制台
 * 2. 输入 `window.__eventDebugger`
 * 3. 可用方法：
 *    - window.__eventDebugger.enable()
 *    - window.__eventDebugger.disable()
 *    - window.__eventDebugger.getStats()
 *    - window.__eventDebugger.clearStats()
 */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).__eventDebugger = {
    enable: enableEventDebugger,
    disable: disableEventDebugger,
    getStats: getEventStats,
    clearStats: clearEventStats,
    isEnabled: isEventDebuggerEnabled,
  };
}
