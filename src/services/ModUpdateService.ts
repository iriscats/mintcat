import { t } from "i18next";
import { exists, stat } from "@tauri-apps/plugin-fs";
import { emitEvent } from "@/events";
import { ModioApi } from "@/apis/modio";
import { ModSourceType } from "@/models/mod/types";
import { TimeUtils } from "@/utils/TimeUtils.ts";
import { StorageAPI } from "@/storage";
import StatusBar from "@/components/StatusBar.tsx";
import type { CompleteModData } from "@/storage/dao/ModDAO";
import type { ModInfo } from "@/apis/modio/ModInfo";
import { taskQueueAPI, TaskPriority } from "tauri-plugin-task-queue-api";

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
     */
    public static async updateMod(mod: CompleteModData) {
        await StatusBar.info(`${t("Update Mod")} [${mod.displayName}]`);
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

        await StatusBar.success(t("Update Finish"));
    }

    /**
     * 批量更新 Modio 模组信息
     * @param mods 模组列表
     */
    public static async batchUpdateMods(mods: CompleteModData[]): Promise<void> {
        // 筛选 Modio 类型的 mod
        const modioMods = mods.filter(m => m.sourceType === ModSourceType.Modio);
        if (modioMods.length === 0) return;

        await StatusBar.info(`${t("Batch Update")} (${modioMods.length} mods)`);

        // 批量获取在线信息
        const platformIds = modioMods.map(m => m.platformId);
        let modInfoList: ModInfo[] = [];
        try {
            modInfoList = await ModioApi.getModInfoByIdList(platformIds);
        } catch (e) {
            console.error("批量获取模组信息失败:", e);
            return;
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

        await StatusBar.success(`${t("Batch Update Finish")} (${modioMods.length} mods)`);
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
     */
    public static async updateModFile(mod: CompleteModData) {
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

        // Update download information in database (cachePath, progress, status)
        const modsApi = await StorageAPI.getMods();
        await modsApi.upsertModDownload({
            modId: mod.modId!,
            cachePath: newItem.download?.cachePath || "",
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

        await StatusBar.success(t("Update Finish"));
    }

    /**
     * 检查在线模组并更新
     */
    public static async checkOnlineModAndUpdate(modItem: CompleteModData, isEnabled: boolean) {
        if (modItem.sourceType === ModSourceType.Modio && isEnabled) {
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
     * 检查模组列表（本地缓存）
     */
    public static async checkModList(onLoadingChange?: (loading: boolean) => void) {
        onLoadingChange?.(true);
        ModUpdateService.loading = true;

        const modsApi = await StorageAPI.getMods();
        const allMods = await modsApi.getAllMods();

        for (const mod of allMods) {
            // Get complete mod data
            const completeModData = await modsApi.getCompleteModData(mod.modId!);
            if (completeModData) {
                await this.checkLocalModCache(completeModData);
            }
        }

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
