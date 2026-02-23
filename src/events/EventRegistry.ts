/**
 * 事件注册表
 * 集中定义所有 Tauri 事件及其 payload 类型
 * 提供完整的 TypeScript 类型安全
 */

import type { UserData } from '@/storage/dao/UserDAO';
import type { CompleteModData } from '@/storage/dao/ModDAO';
import type { GameData } from '@/storage/dao/GameDAO';
import type { TaskData, TaskTypeInfo } from 'tauri-plugin-task-queue';

/**
 * 事件 payload 类型映射
 * 所有事件名称和对应的 payload 类型都在这里定义
 */
export interface EventPayloads {
  // ========================================
  // 应用级事件
  // ========================================

  /** 全局错误消息（字符串或 backend key 对象 { key, ...params }） */
  'app-error': string | { key: string; [k: string]: unknown };

  /** 主题变更 */
  'theme-change': string;

  /** 用户信息加载成功 (from database) */
  'user-info-load-success': UserData;

  /** 游戏信息加载成功 */
  'game-info-load-success': GameData;

  /** 激活游戏变更 */
  'active-game-change': GameData;

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

  /** 用户设置对话框打开 */
  'user-setting-dialog-open': void;

  /** mod.io 未授权/授权错误，payload 为错误信息，用于展示带「前往用户管理」的提示 */
  'modio-unauthorized': string;

  /** 安装失败-游戏路径不存在，payload 为错误信息，用于展示带「选择游戏」的提示 */
  'install-failed-game-path-not-found': string;

  /** 配置管理对话框关闭（用于首次启动引导串联） */
  'config-manage-dialog-closed': void;

  /** 配置导入成功，各页面应刷新本地数据（不整页刷新） */
  'config-imported': void;

  /** 选择游戏对话框关闭（用于首次启动引导串联） */
  'select-game-dialog-closed': void;

  /** 用户设置对话框关闭（用于首次启动引导串联） */
  'user-setting-dialog-closed': void;

  /** 登录对话框打开 */
  'login-dialog-open': void;

  /** 打开新手指引（由用户从标题栏触发） */
  'start-onboarding': void;

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

  /** 下载管理器进度更新 */
  'download-progress': {
    downloadId: string;
    downloadedBytes: number;
    totalBytes: number;
    speedBytesPerSec: number;
    etaSecs: number;
  };

  /** 下载管理器状态更新 */
  'download-status': {
    downloadId: string;
    status: string;
    error?: string;
    filePath?: string;
  };

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

  /**
   * Mod 启用状态变更
   * 用于在 Switch 点击后立即通知标题组件更新样式
   */
  'mod-enabled-change': {
    modId: number;
    enabled: boolean;
  };

  /**
   * Mod 冲突状态更新
   * 用于在冲突检测完成后通知单个 mod 更新显示
   */
  'mod-conflict-update': {
    modId: number;
    hasConflict: boolean;
  };

  /**
   * Mod 冲突检测完成
   * 用于在冲突检测任务完成后通知 UI
   */
  'mod-conflict-check-complete': {
    hasConflicts: boolean;
    count: number;
  };

  // ========================================
  // 安装/集成事件
  // ========================================

  /** Mod 安装完成（保存到游戏），用于通知 HomePage 清除未保存状态 */
  'mods-installed': void;

  /** 安装成功 (payload 为 mod pak timestamp) */
  'install-success': number;

  /** 安装错误（字符串或 backend key 对象 { key, name }） */
  'install-error': string | { key: string; name?: string };

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
  // OAuth 事件
  // ========================================

  /** OAuth 回调接收 */
  'oauth-callback-received': {
    platform: string;
    code?: string;
    accessToken?: string;
    state?: string;
    error?: string;
    errorDescription?: string;
  };

  /** OAuth 成功 */
  'oauth-success': {
    platform: string;
  };

  /** OAuth 失败 */
  'oauth-error': {
    platform: string;
    error: string;
  };

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
