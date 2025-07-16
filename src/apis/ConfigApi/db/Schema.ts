import {sqliteTable, text, integer} from "drizzle-orm/sqlite-core";


// 基础元数据表
export const modMetadata = sqliteTable("mod_metadata", {
    id: integer("id").primaryKey({autoIncrement: true}),
    modId: integer("mod_id").notNull().default(0),
    url: text("url").notNull().default(""),
    nameId: text("name_id").notNull().default(""),
    displayName: text("display_name").notNull().default(""),
    sourceType: integer("source_type").notNull().default(0),
    required: integer("required", {mode: "boolean"}).notNull().default(false),
});

// 下载信息表
export const modDownloadInfo = sqliteTable("mod_download_info", {
    id: integer("id").references(() => modMetadata.id),
    downloadUrl: text("download_url").notNull().default(""),
    cachePath: text("cache_path").notNull().default(""),
    downloadProgress: integer("download_progress").notNull().default(100),
    fileSize: integer("file_size").notNull().default(0),
});

// 版本信息表
export const modVersionInfo = sqliteTable("mod_version_info", {
    id: integer("id").references(() => modMetadata.id),
    fileVersion: text("file_version").notNull().default("-"),
    versions: text("versions", {mode: 'json'}).$type<string[]>().notNull().default([]), // 修复类型问题
    usedVersion: text("used_version").notNull().default(""),
});

// mod 状态表
export const modStatus = sqliteTable("mod_status", {
    id: integer("id").references(() => modMetadata.id),
    enabled: integer("enabled", {mode: "boolean"}).notNull().default(true),
});

// 审核与来源表
export const modApprovalSource = sqliteTable("mod_approval_source", {
    id: integer("id").references(() => modMetadata.id),
    approval: text("approval").notNull().default("Sandbox"),
    tags: text("tags", {mode: 'json'}).$type<string[]>().notNull().default([]), // 修复类型问题
});

// 在线状态表
export const modOnlineStatus = sqliteTable("mod_online_status", {
    id: integer("id").references(() => modMetadata.id),
    lastUpdateDate: integer("last_update_date").notNull().default(0),
    onlineUpdateDate: integer("online_update_date").notNull().default(0),
    onlineAvailable: integer("online_available", {mode: "boolean"}).notNull().default(true),
    localNoFound: integer("local_no_found", {mode: "boolean"}).notNull().default(false),
});

export const profiles = sqliteTable("profiles", {
    id: integer("id").primaryKey({autoIncrement: true}),

});


export const profileDetails = sqliteTable("profile_details", {
    id: integer("id").primaryKey({autoIncrement: true}),

});


export const games = sqliteTable("games", {
    id: integer("id").primaryKey({autoIncrement: true}),
    name: text("game_name").notNull().default(""),
});

