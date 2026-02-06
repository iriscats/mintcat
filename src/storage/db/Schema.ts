import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * ====================================
 * MintCat 数据库 Schema 设计
 * ====================================
 * 
 * 设计原则：
 * 1. 符合第三范式（3NF）：消除传递依赖
 * 2. 每个表有单一职责
 * 3. 合理的索引设计提升查询性能
 * 4. 支持数据完整性和一致性
 * 5. 考虑未来扩展性
 */

// ====================================
// 核心业务表
// ====================================

/**
 * 游戏信息表
 * 存储支持的游戏基本信息
 * 作为游戏相关数据的主表
 */
export const games = sqliteTable("games", {
    id: integer("id").primaryKey({ autoIncrement: true }), // 游戏唯一标识
    name: text("name").notNull(), // 游戏名称
    displayName: text("display_name").notNull(), // 游戏显示名称
    icon: text("icon").notNull().default(""), // 游戏图标URL
    installPath: text("install_path").notNull().default(""), // 游戏安装路径
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true), // 是否启用
    createdAt: integer("created_at", { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
    uniqueIndex("games_name_unique").on(table.name), // 游戏名称唯一索引
    index("games_active_idx").on(table.isActive), // 活跃状态索引
]);

/**
 * 用户信息表
 * 存储用户基本信息和认证数据
 */
export const users = sqliteTable("users", {
    id: integer("id").primaryKey({ autoIncrement: true }), // 用户唯一标识
    username: text("username").notNull(), // 用户名
    email: text("email").notNull().default(""), // 用户邮箱
    avatarUrl: text("avatar_url").notNull().default(""), // 用户头像URL
    createdAt: integer("created_at", { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});


/**
 * OAuth 表
 * 存储用户 OAuth 绑定信息
 */
export const oauths = sqliteTable("oauths", {
    id: integer("id").primaryKey({ autoIncrement: true }), // OAuth记录唯一标识
    uid: integer("uid").notNull().default(0), //  用户ID
    oauth: text("oauth").notNull().default(""), //  OAuth令牌
    platform: text("platform").notNull().default(""), //mod.io
    createdAt: integer("created_at", { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})


/**
 * 模组基础信息表
 * 存储模组的核心元数据
 * 符合第一范式，每个字段都是原子值
 */
export const mods = sqliteTable("mods", {
    modId: integer("mod_id").primaryKey({ autoIncrement: true }), // 内部唯一标识
    platformId: integer("platform_id").notNull().default(0), // platform 平台的模组ID
    gameId: integer("game_id").notNull().references(() => games.id), // 关联游戏表
    nameId: text("name_id").notNull().default(""), // 模组名称标识符
    displayName: text("display_name").notNull(), // 模组显示名称
    originalName: text("original_name").notNull().default(""), // 原始名称（来自 mod.io 或本地文件）
    url: text("url").notNull().default(""), // 模组链接地址
    sourceType: text("source_type").notNull().default("Unknown"), // 模组来源: Local, Modio, Unknown
    tags: text("tags", { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`), // 模组标签列表
    approvalStatus: text("approval_status").notNull().default(""), // 审核状态: Verified, Approved, Sandbox
    dependModId: integer("depend_mod_id").notNull().default(0),
    createdAt: integer("created_at", { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
    index("mods_name_idx").on(table.nameId), // 游戏-模组复合索引
    index("mods_platform_id_idx").on(table.platformId), // platformId 索引（非唯一，因为本地模组共享 platformId=0）
    uniqueIndex("mods_url_unique").on(table.url), // URL唯一索引
]);

/**
 * 模组版本信息表
 * 存储模组的版本相关信息
 * 与mods表一对一关系
 */
export const modVersions = sqliteTable("mod_versions", {
    modId: integer("mod_id").primaryKey().references(() => mods.modId, { onDelete: "cascade" }), // 关联模组表主键
    currentVersion: text("current_version").notNull().default("-"), // 当前文件版本
    availableVersions: text("available_versions", { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`), // 可用版本列表
    createdAt: integer("created_at", { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

/**
 * 模组下载信息表
 * 存储模组的下载和缓存信息
 * 与mods表一对一关系
 */
export const modDownloads = sqliteTable("mod_downloads", {
    modId: integer("mod_id").primaryKey().references(() => mods.modId, { onDelete: "cascade" }), // 关联模组表主键
    downloadUrl: text("download_url").notNull().default(""), // 下载链接
    cachePath: text("cache_path").notNull().default(""), // 本地缓存路径
    fileSize: integer("file_size").notNull().default(0), // 文件大小（字节）
    downloadProgress: integer("download_progress").notNull().default(100), // 下载进度 (0-100)
    downloadStatus: text("download_status").notNull().default("completed"), // 下载状态: pending, downloading, completed, failed
    createdAt: integer("created_at", { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
    index("mod_downloads_status_idx").on(table.downloadStatus), // 下载状态索引
]);

/**
 * 模组审核状态表
 * 存储模组在mod.io平台的审核状态和标签
 * 与mods表一对一关系
 */
export const modStatus = sqliteTable("mod_status", {
    modId: integer("mod_id").primaryKey().references(() => mods.modId, { onDelete: "cascade" }), // 关联模组表主键
    lastUpdateDate: integer("last_update_date").notNull().default(0), // 本地最后更新时间
    onlineUpdateDate: integer("online_update_date").notNull().default(0), // 在线最后更新时间
    isOnlineAvailable: integer("is_online_available", { mode: "boolean" }).notNull().default(true), // 在线是否可用
    isLocalNotFound: integer("is_local_not_found", { mode: "boolean" }).notNull().default(false), // 本地文件是否丢失
    createdAt: integer("created_at", { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
    index("mod_status_status_idx").on(table.isLocalNotFound), // 审核状态索引
    index("mod_status_online_idx").on(table.isOnlineAvailable), // 在线可用性索引
]);

// ====================================
// 配置管理表
// ====================================

/**
 * 配置文件表
 * 存储用户创建的不同配置文件
 * 支持多个模组配置方案
 */
export const profiles = sqliteTable("profiles", {
    id: integer("id").primaryKey({ autoIncrement: true }), // 配置文件唯一标识
    name: text("name").notNull(), // 配置文件名称
    displayName: text("display_name").notNull(), // 显示名称
    gameId: integer("game_id").notNull().references(() => games.id), // 关联游戏
    userId: integer("user_id").notNull().references(() => users.id), // 关联用户
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(false), // 是否为当前激活配置
    description: text("description").notNull().default(""), // 配置描述
    lastUsedAt: integer("last_used_at", { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`), // 最后使用时间
    createdAt: integer("created_at", { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
    uniqueIndex("profiles_name_game_user_unique").on(table.name, table.gameId, table.userId), // 名称-游戏-用户唯一索引
    index("profiles_active_idx").on(table.isActive), // 激活状态索引
    index("profiles_user_game_idx").on(table.userId, table.gameId), // 用户-游戏索引
]);

/**
 * 配置文件文件夹表
 * 支持配置文件内的模组分组和层级管理
 */
export const profileFolders = sqliteTable("profile_folders", {
    id: integer("id").primaryKey({ autoIncrement: true }), // 文件夹唯一标识
    profileId: integer("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }), // 关联配置文件
    parentFolderId: integer("parent_folder_id").references(() => profileFolders.id), // 父文件夹ID（支持层级结构）
    name: text("name").notNull(), // 文件夹名称
    folderType: text("folder_type").notNull().default("custom"), // 文件夹类型: custom
    sortOrder: integer("sort_order").notNull().default(0), // 排序顺序
    isExpanded: integer("is_expanded", { mode: "boolean" }).notNull().default(true), // 是否展开
    createdAt: integer("created_at", { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
    uniqueIndex("profile_folders_profile_name_unique").on(table.profileId, table.name, table.parentFolderId), // 配置-名称-父级唯一索引
    index("profile_folders_profile_sort_idx").on(table.profileId, table.sortOrder), // 配置-排序索引
    index("profile_folders_parent_idx").on(table.parentFolderId), // 父文件夹索引
]);

/**
 * 配置文件模组关联表
 * 多对多关系：配置文件可以包含多个模组，模组可以属于多个配置文件
 */
export const profileMods = sqliteTable("profile_mods", {
    id: integer("id").primaryKey({ autoIncrement: true }), // 关联记录唯一标识
    profileId: integer("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }), // 关联配置文件
    modId: integer("mod_id").notNull().references(() => mods.modId, { onDelete: "cascade" }), // 关联模组
    parentFolderId: integer("parent_folder_id").references(() => profileFolders.id), // 关联父文件夹
    sortOrder: integer("sort_order").notNull().default(0), // 排序顺序
    isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true), // 在该配置中是否启用
    usedVersion: text("used_version").notNull().default(""), // 使用的版本
    createdAt: integer("created_at", { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
    uniqueIndex("profile_mods_profile_mod_unique").on(table.profileId, table.modId), // 配置-模组唯一索引
    index("profile_mods_profile_sort_idx").on(table.profileId, table.sortOrder), // 配置-排序索引
    index("profile_mods_folder_idx").on(table.parentFolderId), // 文件夹索引
]);

// ====================================
// 系统配置表
// ====================================

/**
 * 应用程序设置表
 * 存储全局应用设置
 * 采用单例模式，只存储一条记录
 */
export const settings = sqliteTable("settings", {
    id: integer("id").primaryKey({ autoIncrement: true }), // 设置记录ID
    name: text("name").notNull().default(""), // 设置名称
    value: text("value").notNull().default(""), // 设置值
    createdAt: integer("created_at", { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
    nameUnique: uniqueIndex("settings_name_unique").on(table.name),
}));

// ====================================
// Re-exports for backward compatibility
// These types have been moved to separate files
// ====================================

// Mod types moved to @/models/mod/types
export { ModSourceType, ModApprovalStatus, DownloadStatus } from '@/models/mod/types';

// Constants moved to @/models/mod/types
export { MOD_INVALID_ID } from '@/models/mod/types';

// Profile tree types moved to @/models/profile
export { ProfileTreeType, ProfileTreeGroupType } from '@/models/profile/types';
export { ProfileTreeItem } from '@/models/profile/ProfileTreeItem';
