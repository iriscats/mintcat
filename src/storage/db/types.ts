/**
 * Database Related Types
 *
 * Contains type definitions and enums related to database models
 */

/**
 * 模组来源类型枚举
 */
export enum ModSourceType {
    Local = "Local",
    Modio = "Modio",
    Unknown = "Unknown"
}

/**
 * ModListItem 表示数据库中一个模组的完整视图
 * 包含从多个表中联接的数据
 */
export type ModListItem = {
    id: number; // modId from mods table
    modId: number; // platformId from mods table
    url: string;
    nameId: string;
    displayName: string;
    required: boolean;
    enabled: boolean;
    fileVersion: string;
    tags: string[];
    usedVersion: string;
    versions: string[];
    approval: string;
    sourceType: ModSourceType;
    downloadUrl: string;
    cachePath: string;
    downloadProgress: number;
    fileSize: number;
    lastUpdateDate: number;
    onlineUpdateDate: number;
    onlineAvailable: boolean;
    localNoFound: boolean;
};
