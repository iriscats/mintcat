/**
 * Mod Domain Model Types
 *
 * Contains enums and shared types for the mod domain model
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
 * 模组审核状态枚举
 */
export enum ModApprovalStatus {
    Verified = "Verified",
    Approved = "Approved",
    Sandbox = "Sandbox"
}

/**
 * 下载状态枚举
 */
export enum DownloadStatus {
    Pending = "pending",
    Downloading = "downloading",
    Completed = "completed",
    Failed = "failed"
}

/**
 * 模组相关常量
 */

/**
 * 无效模组ID常量
 */
export const MOD_INVALID_ID = 999999;
