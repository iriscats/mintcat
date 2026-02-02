import { t } from "i18next";
import { exists, stat } from "@tauri-apps/plugin-fs";
import { emitEvent } from "@/events";
import { ModioApi } from "@/apis/modio";
import { ModcatApi, MODCAT_PLATFORM } from "@/apis/modcat";
import { ModSourceType } from "@/models/mod/types";
import { TimeUtils } from "@/utils/TimeUtils.ts";
import { StorageAPI } from "@/storage";
import StatusBar from "@/components/StatusBar.tsx";
import type { CompleteModData } from "@/storage/dao/ModDAO";
import type { ModInfo } from "@/apis/modio/ModInfo";
import { taskQueueAPI, TaskPriority } from "tauri-plugin-task-queue-api";
import { asyncPoolAll } from "@/utils/AsyncPool";

/**
 * ModUpdateService 服务层
 *
 * 封装模组更新相关的业务逻辑
 * - 检查模组更新
 * - 下载模组文件
 * - 检查本地模组缓存
 * - 检查本地模组修改
 */
export class ModUpdateService {

    private static loading = false;

    /**
     * 更新单个模组
     * 支持 Modio 和 ModCat 两种在线来源
     */
    public static async updateMod(mod: CompleteModData) {
        await StatusBar.info(`${t("Update Mod")} [${mod.displayName}]`);
        
        // 根据 sourceType 决定更新方式
        if (mod.sourceType === MODCAT_PLATFORM || mod.sourceType === "modcat") {
            // ModCat 类型的 mod
            await this.updateModcatMod(mod);
            return;
        }
        
        // mod.io 类型的 mod
        const resp = await ModioApi.getModInfoByLink(mod.url || "");
        if (!resp) {
            // Update status to mark as unavailable
            const modsApi = await StorageAPI.getMods();
            await modsApi.upsertModStatus({
                modId: mod.modId!,
                isOnlineAvailable: false
            });
            // Get updated mod data and emit event
            const updatedMod = await modsApi.getCompleteModData(mod.modId!);
            if (updatedMod) {
                await emitEvent("mod-treeview-update", {
                    modId: updatedMod.modId!,
                    data: updatedMod
                });
            }
            return;
        }

        // Update mod in database
        await this.updateModInDatabase(mod.modId!, resp);
        await this.updateModFile(mod);

        await StatusBar.success(`${t("Update Finish")}: ${mod.displayName}`);
    }

    /**
     * 更新 ModCat 类型的模组
     * 获取在线信息并下载文件
     */
    private static async updateModcatMod(mod: CompleteModData): Promise<void> {
        const modsApi = await StorageAPI.getMods();
        const modId = mod.nameId;
        
        if (!modId) {
            await modsApi.upsertModStatus({
                modId: mod.modId!,
                isOnlineAvailable: false
            });
            return;
        }

        // 获取 mod 详情
        const modDetail = await ModcatApi.getModDetail(modId);
        if (!modDetail) {
            // 标记为不可用
            await modsApi.upsertModStatus({
                modId: mod.modId!,
                isOnlineAvailable: false
            });
            const updatedMod = await modsApi.getCompleteModData(mod.modId!);
            if (updatedMod) {
                await emitEvent("mod-treeview-update", {
                    modId: updatedMod.modId!,
                    data: updatedMod
                });
            }
            return;
        }

        // 获取最新版本信息
        const latestVersion = modDetail.ModVersionEntities
            ?.filter(v => v.Status === "Approved" && v.FilesId)
            .sort((a, b) => {
                const dateA = new Date(a.CreatedAt || 0).getTime();
                const dateB = new Date(b.CreatedAt || 0).getTime();
                return dateB - dateA;
            })[0];

        // 更新数据库中的模组信息
        await modsApi.upsertModVersion({
            modId: mod.modId!,
            currentVersion: latestVersion?.VersionNumber || mod.version?.currentVersion || "-",
            availableVersions: []
        });

        // 更新下载信息
        if (latestVersion?.FilesId) {
            await modsApi.upsertModDownload({
                modId: mod.modId!,
                downloadUrl: ModcatApi.getDownloadUrl(latestVersion.FilesId),
                fileSize: parseInt(latestVersion.Files?.Size || "0", 10)
            });
        }

        // 更新状态：设置在线更新时间
        const onlineUpdateDate = latestVersion?.UpdatedAt 
            ? new Date(latestVersion.UpdatedAt).getTime() 
            : TimeUtils.now();
        await modsApi.upsertModStatus({
            modId: mod.modId!,
            onlineUpdateDate: onlineUpdateDate,
            isOnlineAvailable: true
        });

        // 下载文件
        await this.updateModFile(mod);

        await StatusBar.success(`${t("Update Finish")}: ${mod.displayName}`);
    }

    /**
     * 批量更新模组信息
     * 支持 Modio 和 ModCat 两种在线来源
     * @param mods 模组列表
     */
    public static async batchUpdateMods(mods: CompleteModData[]): Promise<void> {
        // 筛选在线类型的 mod
        const modioMods = mods.filter(m => m.sourceType === ModSourceType.Modio);
        const modcatMods = mods.filter(m => m.sourceType === MODCAT_PLATFORM || m.sourceType === "modcat");
        
        const totalOnlineMods = modioMods.length + modcatMods.length;
        if (totalOnlineMods === 0) return;

        await StatusBar.info(`${t("Batch Update")} (${totalOnlineMods} mods)`);

        // 批量更新 Modio 类型的 mod
        if (modioMods.length > 0) {
            const platformIds = modioMods.map(m => m.platformId);
            let modInfoList: ModInfo[] = [];
            try {
                modInfoList = await ModioApi.getModInfoByIdList(platformIds);
            } catch (e) {
                console.error("批量获取 Modio 模组信息失败:", e);
            }

            // 创建 id 到 modInfo 的映射
            const modInfoMap = new Map(modInfoList.map(m => [m.id, m]));

            // 更新数据库
            for (const mod of modioMods) {
                const modInfo = modInfoMap.get(mod.platformId);
                if (modInfo) {
                    await this.updateModInDatabase(mod.modId!, modInfo);
                } else {
                    // 标记为不可用
                    await this.markModUnavailable(mod.modId!);
                }
            }
        }

        // 批量更新 ModCat 类型的 mod（逐个获取详情）
        if (modcatMods.length > 0) {
            for (const mod of modcatMods) {
                try {
                    await this.updateModcatModInfo(mod);
                } catch (e) {
                    console.error(`更新 ModCat 模组信息失败: ${mod.displayName}`, e);
                    await this.markModUnavailable(mod.modId!);
                }
            }
        }

        await StatusBar.success(`${t("Batch Update Finish")} (${totalOnlineMods} mods)`);
    }

    /**
     * 更新 ModCat 模组的在线信息（不下载文件）
     */
    private static async updateModcatModInfo(mod: CompleteModData): Promise<void> {
        const modsApi = await StorageAPI.getMods();
        const modId = mod.nameId;
        
        if (!modId) {
            await this.markModUnavailable(mod.modId!);
            return;
        }

        // 获取 mod 详情
        const modDetail = await ModcatApi.getModDetail(modId);
        if (!modDetail) {
            await this.markModUnavailable(mod.modId!);
            return;
        }

        // 获取最新版本信息
        const latestVersion = modDetail.ModVersionEntities
            ?.filter(v => v.Status === "Approved" && v.FilesId)
            .sort((a, b) => {
                const dateA = new Date(a.CreatedAt || 0).getTime();
                const dateB = new Date(b.CreatedAt || 0).getTime();
                return dateB - dateA;
            })[0];

        // 更新版本信息
        await modsApi.upsertModVersion({
            modId: mod.modId!,
            currentVersion: latestVersion?.VersionNumber || mod.version?.currentVersion || "-",
            availableVersions: []
        });

        // 更新下载信息
        if (latestVersion?.FilesId) {
            await modsApi.upsertModDownload({
                modId: mod.modId!,
                downloadUrl: ModcatApi.getDownloadUrl(latestVersion.FilesId),
                fileSize: parseInt(latestVersion.Files?.Size || "0", 10)
            });
        }

        // 更新状态
        const onlineUpdateDate = latestVersion?.UpdatedAt 
            ? new Date(latestVersion.UpdatedAt).getTime() 
            : TimeUtils.now();
        await modsApi.upsertModStatus({
            modId: mod.modId!,
            onlineUpdateDate: onlineUpdateDate,
            isOnlineAvailable: true
        });

        // 发送更新事件
        const updatedMod = await modsApi.getCompleteModData(mod.modId!);
        if (updatedMod) {
            await emitEvent("mod-treeview-update", {
                modId: updatedMod.modId!,
                data: updatedMod
            });
        }
    }

    /**
     * 批量并行下载模组文件
     * @param mods 需要下载的模组列表
     * @param concurrency 并发数量，默认 3
     * @returns 成功数量和错误列表
     */
    public static async batchDownloadModFiles(
        mods: CompleteModData[],
        concurrency: number = 3
    ): Promise<{ successCount: number; errors: Array<{ mod: CompleteModData; error: Error }> }> {
        if (mods.length === 0) {
            return { successCount: 0, errors: [] };
        }

        await StatusBar.info(`${t("Batch Download")} (${mods.length} mods, ${concurrency} concurrent)`);

        const { errors } = await asyncPoolAll(
            mods,
            async (mod) => {
                await this.updateModFile(mod);
                return mod;
            },
            concurrency
        );

        const successCount = mods.length - errors.length;

        if (errors.length > 0) {
            await StatusBar.error(`${t("Batch Download")} ${successCount}/${mods.length} (${errors.length} failed)`);
        } else {
            await StatusBar.success(`${t("Batch Download Finish")} (${mods.length} mods)`);
        }

        return {
            successCount,
            errors: errors.map(e => ({ mod: e.item, error: e.error }))
        };
    }

    /**
     * 标记模组为不可用
     */
    private static async markModUnavailable(modId: number): Promise<void> {
        const modsApi = await StorageAPI.getMods();
        await modsApi.upsertModStatus({
            modId: modId,
            isOnlineAvailable: false
        });
        // Get updated mod data and emit event
        const updatedMod = await modsApi.getCompleteModData(modId);
        if (updatedMod) {
            await emitEvent("mod-treeview-update", {
                modId: updatedMod.modId!,
                data: updatedMod
            });
        }
    }

    /**
     * 更新数据库中的模组信息
     */
    private static async updateModInDatabase(modId: number, modInfo: any) {
        const modsApi = await StorageAPI.getMods();
        const modData = await modsApi.getModById(modId);
        if (!modData) return;

        // 获取远程名称
        const remoteName = modInfo.name || "";

        const updatePayload: any = {
            nameId: modInfo.name_id || modData.nameId,
            url: modInfo.profile_url || modData.url,
            tags: modInfo.tags ? modInfo.tags.map((tag: any) => tag.name) : modData.tags,
            originalName: remoteName || modData.originalName,  // 始终更新 originalName
        };

        // Update basic mod info
        await modsApi.updateMod(modId, updatePayload);

        // Update version info
        await modsApi.upsertModVersion({
            modId: modId,
            currentVersion: modInfo.modfile?.version || modInfo.modfile?.filename || "-",
            availableVersions: []
        });

        // Update download info (only URL and fileSize, preserve downloadProgress)
        await modsApi.upsertModDownload({
            modId: modId,
            downloadUrl: modInfo.modfile?.download?.binary_url || "",
            fileSize: modInfo.modfile?.filesize || 0
        });

        // Update status info with current online update date
        // Note: mod.io API returns Unix timestamp in seconds, but we store milliseconds
        const onlineUpdateDate = TimeUtils.fromModio(modInfo.date_updated) || TimeUtils.now();
        await modsApi.upsertModStatus({
            modId: modId,
            onlineUpdateDate: onlineUpdateDate,
            isOnlineAvailable: true
        });

        // Emit event to refresh UI (show "new version" indicator if needed)
        const updatedMod = await modsApi.getCompleteModData(modId);
        if (updatedMod) {
            await emitEvent("mod-treeview-update", {
                modId: updatedMod.modId!,
                data: updatedMod
            });
        }
    }

    /**
     * 更新模组文件（下载）
     * 支持 Modio 和 ModCat 两种在线来源
     */
    public static async updateModFile(mod: CompleteModData) {
        let cachePath = "";
        
        // 根据 sourceType 选择不同的下载方式
        if (mod.sourceType === MODCAT_PLATFORM || mod.sourceType === "modcat") {
            // ModCat 类型的 mod
            cachePath = await this.downloadModcatFile(mod);
        } else {
            // Modio 类型的 mod (默认)
            const newItem = await ModioApi.downloadModFile(mod, async (loaded: number, total: number) => {
                await StatusBar.info(`${t("Downloading")} [${mod.displayName}] (${loaded} / ${total})`);
                const downloadProgress = (loaded / total) * 100;
                // Update mod download progress and emit event
                const updatedMod = { ...mod };
                if (updatedMod.download) {
                    updatedMod.download = { ...updatedMod.download, downloadProgress };
                }
                await emitEvent("mod-treeview-update", {
                    modId: updatedMod.modId!,
                    data: updatedMod
                });
            });
            cachePath = newItem.download?.cachePath || "";
        }

        // Update download information in database (cachePath, progress, status)
        const modsApi = await StorageAPI.getMods();
        await modsApi.upsertModDownload({
            modId: mod.modId!,
            cachePath: cachePath,
            downloadProgress: 100,
            downloadStatus: "completed"
        });

        // Update fileVersion to match the downloaded version
        if (mod.version?.currentVersion) {
            await modsApi.upsertModVersion({
                modId: mod.modId!,
                currentVersion: mod.version.currentVersion,
                availableVersions: mod.version.availableVersions || []
            });
        }

        // Update lastUpdateDate to matchUpdateDate after successful download
        const currentStatus = await modsApi.getModStatus(mod.modId!);
        if (currentStatus) {
            await modsApi.upsertModStatus({
                modId: mod.modId!,
                lastUpdateDate: currentStatus.onlineUpdateDate || TimeUtils.now()
            });
        }

        // Get updated mod data and emit event to refresh UI (clear "new version" indicator)
        const updatedMod = await modsApi.getCompleteModData(mod.modId!);
        if (updatedMod) {
            await emitEvent("mod-treeview-update", {
                modId: updatedMod.modId!,
                data: updatedMod
            });
        }

        await StatusBar.success(`${t("Update Finish")}: ${mod.displayName}`);
    }

    /**
     * 下载 ModCat 类型的 mod 文件
     * @param mod 模组数据
     * @returns 下载后的缓存路径
     */
    private static async downloadModcatFile(mod: CompleteModData): Promise<string> {
        // 通过 nameId (modcat 的 ModId) 获取 mod 详情
        const modId = mod.nameId;
        
        if (!modId) {
            throw new Error(`ModCat mod missing nameId: ${mod.displayName}`);
        }

        // 获取 mod 详情以获取最新的下载信息
        const modDetail = await ModcatApi.getModDetail(modId);
        
        if (!modDetail) {
            throw new Error(`${t("Fetch Mod Info Error")}: ${mod.displayName}`);
        }

        // 下载文件
        const result = await ModcatApi.downloadModFile(modDetail, async (loaded: number, total: number) => {
            await StatusBar.info(`${t("Downloading")} [${mod.displayName}] (${loaded} / ${total})`);
            const downloadProgress = total > 0 ? (loaded / total) * 100 : 0;
            // Update mod download progress and emit event
            const updatedMod = { ...mod };
            if (updatedMod.download) {
                updatedMod.download = { ...updatedMod.download, downloadProgress };
            }
            await emitEvent("mod-treeview-update", {
                modId: updatedMod.modId!,
                data: updatedMod
            });
        });

        return result.cachePath || "";
    }

    /**
     * 检查在线模组并更新
     * 支持 Modio 和 ModCat 两种在线来源
     */
    public static async checkOnlineModAndUpdate(modItem: CompleteModData, isEnabled: boolean) {
        const isOnlineMod = modItem.sourceType === ModSourceType.Modio || 
                           modItem.sourceType === MODCAT_PLATFORM || 
                           modItem.sourceType === "modcat";
        
        if (isOnlineMod && isEnabled) {
            const cachePath = modItem.download?.cachePath || "";
            const onlineUpdateDate = modItem.status?.onlineUpdateDate || 0;
            const lastUpdateDate = modItem.status?.lastUpdateDate || 0;
            const downloadProgress = modItem.download?.downloadProgress || 0;

            if (!await exists(cachePath) ||
                onlineUpdateDate > lastUpdateDate ||
                downloadProgress != 100
            ) {
                await ModUpdateService.updateMod(modItem);
            }
        }
    }

    /**
     * 检查本地模组缓存
     */
    public static async checkLocalModCache(modItem: CompleteModData) {
        if (modItem.sourceType === ModSourceType.Local) {
            const cachePath = modItem.download?.cachePath || "";
            const modsApi = await StorageAPI.getMods();

            if (!await exists(cachePath)) {
                await modsApi.upsertModStatus({
                    modId: modItem.modId!,
                    isLocalNotFound: true
                });
                // Get updated mod data and emit event
                const updatedMod = await modsApi.getCompleteModData(modItem.modId!);
                if (updatedMod) {
                    await emitEvent("mod-treeview-update", {
                        modId: updatedMod.modId!,
                        data: updatedMod
                    });
                }
                return false;
            } else {
                await modsApi.upsertModStatus({
                    modId: modItem.modId!,
                    isLocalNotFound: false
                });
            }

            // Get updated mod data and emit event
            const updatedMod = await modsApi.getCompleteModData(modItem.modId!);
            if (updatedMod) {
                await emitEvent("mod-treeview-update", {
                    modId: updatedMod.modId!,
                    data: updatedMod
                });
            }
        }
        return true;
    }

    /**
     * 批量检查本地模组缓存（优化版本）
     * 只检查本地类型的模组，减少不必要的操作
     */
    public static async batchCheckLocalModCache(allMods: CompleteModData[]): Promise<void> {
        const localMods = allMods.filter(m => m.sourceType === ModSourceType.Local);
        if (localMods.length === 0) return;

        const modsApi = await StorageAPI.getMods();
        const updatePromises: Promise<void>[] = [];

        for (const modItem of localMods) {
            const cachePath = modItem.download?.cachePath || "";
            
            // 使用并行检查文件是否存在
            updatePromises.push((async () => {
                const fileExists = await exists(cachePath);
                const currentNotFound = modItem.status?.isLocalNotFound ?? false;
                
                // 只有状态变化时才更新数据库和发送事件
                if (fileExists === currentNotFound) {
                    await modsApi.upsertModStatus({
                        modId: modItem.modId!,
                        isLocalNotFound: !fileExists
                    });
                    
                    // 更新内存中的状态并发送事件
                    const updatedMod = { 
                        ...modItem, 
                        status: { 
                            ...modItem.status, 
                            modId: modItem.modId!,
                            isLocalNotFound: !fileExists 
                        } 
                    };
                    await emitEvent("mod-treeview-update", {
                        modId: updatedMod.modId!,
                        data: updatedMod
                    });
                }
            })());
        }

        // 并行执行所有检查
        await Promise.all(updatePromises);
    }

    /**
     * 检查本地模组是否被修改
     */
    public static async checkLocalModModify(modItem: CompleteModData, isEnabled: boolean) {
        if (modItem.sourceType === ModSourceType.Local && isEnabled) {
            const cachePath = modItem.download?.cachePath || "";
            if (await exists(cachePath)) {
                const fileInfo = await stat(cachePath);
                // fileInfo.mtime.getTime() returns milliseconds, store as-is
                const mtime = fileInfo.mtime.getTime();
                const lastUpdateDate = modItem.status?.lastUpdateDate || 0;

                if (mtime === lastUpdateDate) {
                    return false;
                } else {
                    const modsApi = await StorageAPI.getMods();
                    await modsApi.upsertModStatus({
                        modId: modItem.modId!,
                        lastUpdateDate: mtime
                    });
                    // Get updated mod data and emit event
                    const updatedMod = await modsApi.getCompleteModData(modItem.modId!);
                    if (updatedMod) {
                        await emitEvent("mod-treeview-update", {
                            modId: updatedMod.modId!,
                            data: updatedMod
                        });
                    }
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * 检查模组列表（本地缓存）- 优化版本
     * 使用批量查询代替 N+1 查询
     */
    public static async checkModList(onLoadingChange?: (loading: boolean) => void) {
        onLoadingChange?.(true);
        ModUpdateService.loading = true;

        const modsApi = await StorageAPI.getMods();
        
        // 使用优化的批量查询，一次获取所有完整数据
        const allCompleteMods = await modsApi.getAllCompleteModData();

        // 使用批量检查方法
        await this.batchCheckLocalModCache(allCompleteMods);

        ModUpdateService.loading = false;
        onLoadingChange?.(false);
        return true;
    }

    /**
     * 检查模组列表（使用预加载的数据）
     * 当调用方已有完整的 mod 数据时使用，避免重复查询
     */
    public static async checkModListWithData(
        allMods: CompleteModData[], 
        onLoadingChange?: (loading: boolean) => void
    ) {
        onLoadingChange?.(true);
        ModUpdateService.loading = true;

        // 使用批量检查方法
        await this.batchCheckLocalModCache(allMods);

        ModUpdateService.loading = false;
        onLoadingChange?.(false);
        return true;
    }

    /**
     * 检查模组更新（在线）- 通过任务系统执行
     */
    public static async checkModUpdate(): Promise<void> {
        if (ModUpdateService.loading) {
            return;
        }

        const taskId = await taskQueueAPI.addTask({
            taskType: 'check_mod_update',
            params: {},
            priority: TaskPriority.Low
        });

        // Wait for task completion to maintain backwards compatibility
        await taskQueueAPI.waitForTaskCompletion(taskId);
    }
}
