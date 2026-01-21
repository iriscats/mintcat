/**
 * 事件注册表
 * 集中定义所有 Tauri 事件及其 payload 类型
 * 提供完整的 TypeScript 类型安全
 */

import type { UserData } from '@/storage/dao/UserDAO';
import type { CompleteModData } from '@/storage/dao/ModDAO';
import type { GameData } from '@/storage/dao/GameDAO';
import type { TaskData, TaskTypeInfo } from 'tauri-plugin-task-queue-api';

/**
 * 事件 payload 类型映射
 * 所有事件名称和对应的 payload 类型都在这里定义
 */
export interface EventPayloads {
  // ========================================
  // 应用级事件
  // ========================================

  /** 全局错误消息 */
  'app-error': string;

  /** 主题变更 */
  'theme-change': string;

  /** 用户信息加载成功 (from database) */
  'user-info-load-success': UserData;

  /** 游戏信息加载成功 */
  'game-info-load-success': GameData;

  /** 激活游戏变更 */
  'active-game-change': GameData;

  // ========================================
  // UI 更新事件
  // ========================================

  /** 主页树形视图更新 */
  'home-page-update-tree-view': void;

  /** 主页配置文件选择更新 */
  'home-page-update-profile-select': void;

  /** 主页加载状态 */
  'home-page-loading': boolean;

  /** 树形视图计数标签更新 */
  'tree-view-count-label-update': void;

  // ========================================
  // 状态栏事件
  // ========================================

  /** 状态栏日志消息 */
  'status-bar-log': string | { message: string; level?: 'info' | 'success' | 'warning' | 'error' };

  /** 状态栏进度百分比 (0-100) */
  'status-bar-percent': number;

  // ========================================
  // 对话框事件
  // ========================================

  /** 配置管理对话框打开 */
  'config-manage-dialog-open': void;

  /** 标题栏头像加载 */
  'title-bar-load-avatar': void;

  /** 添加模组对话框初始化数据 */
  'add-mod-dialog-init-data': {
    text: string;
    groupId: number;
    addModType: string;
  };

  /** 添加模组对话框确认 */
  'add-mod-dialog-ok': {
    addModType: string;
    groupId: number;
    list: string[];
  };

  /** 添加模组对话框关闭 */
  'add-mod-dialog-close': void;

  /** 选择游戏对话框打开 */
  'select-game-dialog-open': void;

  /** 登录对话框打开 */
  'login-dialog-open': void;

  // ========================================
  // 下载事件
  // ========================================

  /** 下载进度更新 */
  'download-api-progress': {
    downloadedSize: number;
    totalSize: number;
  };

  /** 下载状态更新 (修复拼写: 原 download-api-statue) */
  'download-api-status': string;

  // ========================================
  // Mod 更新事件
  // ========================================

  /**
   * Mod 树形视图更新
   *
   * 重要改进：消除动态事件名！
   * BEFORE: emit("mod-treeview-update" + modId, data)
   * AFTER:  emit("mod-treeview-update", { modId, data })
   *
   * 监听器使用过滤器只处理特定 modId 的更新
   */
  'mod-treeview-update': {
    modId: number;
    data: CompleteModData;
  };

  // ========================================
  // 安装/集成事件
  // ========================================

  /** 安装成功 (payload 为 mod pak timestamp) */
  'install-success': number;

  /** 安装错误 (payload 为模组名称) */
  'install-error': string;

  // ========================================
  // 任务队列事件
  // ========================================

  /**
   * 任务更新
   * 注意：重命名为 kebab-case (原 task_updated)
   */
  'task-updated': TaskData;

  /**
   * 任务类型注册
   * 注意：重命名为 kebab-case (原 task_type_registered)
   */
  'task-type-registered': TaskTypeInfo;

  /**
   * 任务类型更新
   * 注意：重命名为 kebab-case (原 task_type_updated)
   */
  'task-type-updated': TaskTypeInfo;

  /**
   * 任务类型注销
   * 注意：重命名为 kebab-case (原 task_type_unregistered)
   */
  'task-type-unregistered': string;

  /**
   * 前端任务启动
   * 注意：重命名为 kebab-case (原 frontend_task_start)
   */
  'frontend-task-start': TaskData;

  // ========================================
  // Tauri 内部事件
  // ========================================

  /** 文件拖放事件 */
  'tauri://file-drop': {
    paths: string[];
    position: { x: number; y: number };
  };
}

/**
 * 所有有效的事件名称类型
 * 使用此类型确保事件名称的类型安全
 */
export type EventName = keyof EventPayloads;

/**
 * 获取指定事件的 payload 类型
 *
 * @example
 * type ErrorPayload = EventPayload<'app-error'>;  // string
 * type ModUpdatePayload = EventPayload<'mod-treeview-update'>;  // { modId: number; data: CompleteModData }
 */
export type EventPayload<E extends EventName> = EventPayloads[E];

/**
 * 检查 payload 是否为 void 类型
 * 用于区分需要 payload 的事件和不需要 payload 的事件
 */
export type IsVoidPayload<E extends EventName> = EventPayloads[E] extends void ? true : false;

/**
 * 只包含 void payload 的事件名称
 */
export type VoidEventName = {
  [K in EventName]: EventPayloads[K] extends void ? K : never;
}[EventName];

/**
 * 只包含非 void payload 的事件名称
 */
export type NonVoidEventName = {
  [K in EventName]: EventPayloads[K] extends void ? never : K;
}[EventName];
