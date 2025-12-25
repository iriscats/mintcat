import type { CompleteModData } from '@/storage/dao/ModDAO';
import { ModSourceType, ModApprovalStatus } from '@/models/mod/types';
import { TimeUtils } from '@/utils/TimeUtils';

/**
 * Mod 工具函数
 *
 * 为 CompleteModData 提供业务逻辑方法，避免创建额外的领域模型类
 */
export const ModHelpers = {
    /**
     * 模组是否为必需模组
     */
    isRequired(mod: CompleteModData): boolean {
        return mod.tags?.includes('RequiredByAll') ?? false;
    },

    /**
     * 模组是否已验证
     */
    isVerified(mod: CompleteModData): boolean {
        return mod.approvalStatus === ModApprovalStatus.Verified;
    },

    /**
     * 模组是否来自 mod.io
     */
    isFromModio(mod: CompleteModData): boolean {
        return mod.sourceType === ModSourceType.Modio;
    },

    /**
     * 模组是否为本地模组
     */
    isLocal(mod: CompleteModData): boolean {
        return mod.sourceType === ModSourceType.Local;
    },

    /**
     * 是否需要下载
     */
    needsDownload(mod: CompleteModData): boolean {
        const downloadComplete = (mod.download?.downloadProgress ?? 0) === 100;
        const localNotFound = mod.status?.isLocalNotFound ?? false;
        return !downloadComplete || localNotFound;
    },

    /**
     * 是否需要更新
     */
    needsUpdate(mod: CompleteModData): boolean {
        const onlineDate = mod.status?.onlineUpdateDate ?? 0;
        const localDate = mod.status?.lastUpdateDate ?? 0;
        return TimeUtils.hasUpdate(onlineDate, localDate);
    },

    /**
     * 是否可以更新
     */
    canUpdate(mod: CompleteModData): boolean {
        const isOnlineAvailable = mod.status?.isOnlineAvailable ?? false;
        return ModHelpers.needsUpdate(mod) && isOnlineAvailable;
    },

    /**
     * 下载是否完成
     */
    isDownloadComplete(mod: CompleteModData): boolean {
        return (mod.download?.downloadProgress ?? 0) === 100
            && mod.download?.downloadStatus === 'completed';
    },

    /**
     * 是否正在下载
     */
    isDownloading(mod: CompleteModData): boolean {
        return mod.download?.downloadStatus === 'downloading';
    },

    /**
     * 获取显示标题
     */
    getDisplayTitle(mod: CompleteModData): string {
        return mod.displayName || mod.nameId || mod.url || "";
    },

    /**
     * 本地文件是否可用
     */
    isAvailableLocally(mod: CompleteModData): boolean {
        return !(mod.status?.isLocalNotFound ?? false);
    },

    /**
     * 是否有多个版本可选
     */
    hasMultipleVersions(mod: CompleteModData): boolean {
        return (mod.version?.availableVersions?.length ?? 0) > 1;
    },

    /**
     * 检查指定版本是否可用
     */
    isVersionAvailable(mod: CompleteModData, version: string): boolean {
        return mod.version?.availableVersions?.includes(version) ?? false;
    }
};
