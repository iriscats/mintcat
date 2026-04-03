import { ModSourceType, ModApprovalStatus } from '@/models/mod/types';
import type { CompleteModData } from '@/storage/dao/ModDAO';
import { TimeUtils } from '@/utils/TimeUtils';
import type { ModcatModEntity } from '@/apis/modcat/types';
import { MODCAT_PLATFORM, ModcatApi } from '@/apis/modcat';

/**
 * ModMapper 映射器
 *
 * 集中所有模组数据转换逻辑，消除重复代码
 * 负责从外部来源（mod.io API、本地文件）转换到 CompleteModData
 */
export class ModMapper {

    // =============================
    // 外部 API → DAO DTO
    // =============================

    /**
     * 从 mod.io API 响应转换到 CompleteModData
     */
    static fromModioResponse(modInfo: any): CompleteModData {
        // 提取标签并过滤版本号等，避免写入 tags（与添加 mod 窗口等所有入口一致）
        const rawTags = modInfo.tags ? modInfo.tags.map((tag: any) => tag.name) : [];
        const { tags, versions, approval } = ModMapper.parseTags(rawTags);

        const modName = modInfo.name || "";

        const dto: CompleteModData = {
            modId: undefined,  // 尚未存入数据库
            platformId: modInfo.id,
            gameId: 1,  // DRG 游戏 ID
            nameId: modInfo.name_id || "",
            displayName: modName,
            originalName: modName,
            url: modInfo.profile_url || "",
            sourceType: ModSourceType.Modio,
            tags: tags,
            approvalStatus: approval,
            version: {
                modId: 0,  // 临时值，存入数据库后会被设置
                currentVersion: modInfo.modfile?.version || modInfo.modfile?.filename || "-",
                availableVersions: versions
            },
            download: {
                modId: 0,
                downloadUrl: modInfo.modfile?.download?.binary_url || "",
                cachePath: "",
                fileSize: modInfo.modfile?.filesize || 0,
                downloadProgress: 0,
                downloadStatus: "pending"
            },
            status: {
                modId: 0,
                lastUpdateDate: TimeUtils.now(),
                onlineUpdateDate: TimeUtils.now(),
                isOnlineAvailable: true,
                isLocalNotFound: false
            }
        };

        return dto;
    }

    /**
     * 从 ModCat API 响应转换到 CompleteModData
     */
    static fromModcatResponse(mod: ModcatModEntity): CompleteModData {
        // 提取标签并过滤掉版本号类（避免版本被当成 tag 写入）
        const rawTags = mod.ModTypeEntities?.map(t => t.Types?.TypeName).filter(Boolean) as string[] || [];
        const tags = ModMapper.filterTagsForStorage(rawTags);

        // 获取最新版本 - 放宽过滤条件，因为 Status 可能是 null 或其他值
        const latestVersion = mod.ModVersionEntities
            ?.filter(v => v.FilesId) // 只要有文件 ID 就可以
            .sort((a, b) => {
                const dateA = new Date(a.CreatedAt || 0).getTime();
                const dateB = new Date(b.CreatedAt || 0).getTime();
                return dateB - dateA;
            })[0];

        const modName = mod.Name || "";
        const modId = mod.ModId || "";

        const dto: CompleteModData = {
            modId: undefined,  // 尚未存入数据库
            platformId: 0,     // ModCat 使用字符串 ID，这里用 0
            gameId: 1,         // DRG 游戏 ID
            nameId: modId,
            displayName: modName,
            originalName: modName,
            url: ModcatApi.getModUrl(modId),
            sourceType: MODCAT_PLATFORM as any,
            tags: tags,
            approvalStatus: ModApprovalStatus.Approved,  // ModCat 上的 mod 默认为已批准
            version: {
                modId: 0,
                currentVersion: latestVersion?.VersionNumber || "-",
                // 放宽过滤条件，只要有 FilesId 就可以（与获取最新版本逻辑一致）
                availableVersions: mod.ModVersionEntities
                    ?.filter(v => v.FilesId)
                    .map(v => v.VersionNumber || "")
                    .filter(Boolean) || []
            },
            download: {
                modId: 0,
                downloadUrl: latestVersion?.FilesId 
                    ? `https://modcat.top:8089/api/Files/DownloadFileGet?FileId=${encodeURIComponent(latestVersion.FilesId)}&NoCount=true`
                    : "",
                cachePath: "",
                fileSize: parseInt(latestVersion?.Files?.Size || "0", 10),
                downloadProgress: 0,
                downloadStatus: "pending"
            },
            status: {
                modId: 0,
                lastUpdateDate: TimeUtils.now(),
                onlineUpdateDate: latestVersion?.UpdatedAt 
                    ? new Date(latestVersion.UpdatedAt).getTime() 
                    : TimeUtils.now(),
                isOnlineAvailable: true,
                isLocalNotFound: false
            }
        };

        return dto;
    }

    /**
     * 从本地文件路径转换到 CompleteModData
     * 迁移自 HomeViewModel.addModFromPath()
     */
    static fromLocalPath(filePath: string, fileName: string): CompleteModData {
        const dto: CompleteModData = {
            modId: undefined,
            platformId: 0,
            gameId: 1,
            nameId: fileName,
            displayName: fileName,
            originalName: fileName,
            url: filePath,
            sourceType: ModSourceType.Local,
            tags: [],
            approvalStatus: ModApprovalStatus.Unknown,
            version: {
                modId: 0,
                currentVersion: "-",
                availableVersions: []
            },
            download: {
                modId: 0,
                downloadUrl: "",
                cachePath: filePath,
                fileSize: 0,
                downloadProgress: 100,
                downloadStatus: "completed"
            },
            status: {
                modId: 0,
                lastUpdateDate: TimeUtils.now(),
                onlineUpdateDate: 0,
                isOnlineAvailable: false,
                isLocalNotFound: false
            }
        };

        return dto;
    }

    // =============================
    // 辅助方法
    // =============================

    /** 匹配“像版本号”的 tag（如 1.35.0、2.0、v1.2），避免把版本号误归为普通 tag */
    private static readonly VERSION_LIKE_TAG = /^v?\d+\.\d+(\.\d+)*$/i;

    /**
     * 从原始标签列表中筛掉“版本号”类标签，只保留用于展示的 tag。
     * 添加/更新 mod 时统一用此方法写库，避免把版本写入 tags。
     */
    public static filterTagsForStorage(rawTags: string[]): string[] {
        return ModMapper.parseTags(rawTags ?? []).tags;
    }


    /**
     * 从原始标签列表中提取审核状态。
     */
    public static extractApprovalStatus(rawTags: string[]): ModApprovalStatus {
        return ModMapper.parseTags(rawTags ?? []).approval;
    }

    /**
     * 从原始标签列表中提取版本号列表（最新在前）。
     */
    public static extractVersions(rawTags: string[]): string[] {
        return ModMapper.parseTags(rawTags ?? []).versions;
    }

    /**
     * 完整解析原始标签，返回 tags、versions、approval。
     * 供需要同时获取多个结果的调用方使用，避免多次 parseTags。
     */
    public static parseTags(rawTags: string[]): {
        tags: string[];
        versions: string[];
        approval: ModApprovalStatus;
    } {
        const tags: string[] = [];
        const versions: string[] = [];
        let approval: ModApprovalStatus = ModApprovalStatus.Unknown;

        for (const tag of rawTags) {
            if (ModMapper.VERSION_LIKE_TAG.test(tag.trim())) {
                versions.push(tag.trim());
            } else if (tag === "Verified" || tag === "Auto-Verified") {
                approval = ModApprovalStatus.Verified;
            } else if (tag === "Approved") {
                approval = ModApprovalStatus.Approved;
            } else if (tag === "Sandbox") {
                approval = ModApprovalStatus.Sandbox;
            } else {
                tags.push(tag);
            }
        }

        versions.reverse();

        return { tags, versions, approval };
    }

}
