import { t } from "i18next";
import { exists, stat, remove } from "@tauri-apps/plugin-fs";
import { emitEvent } from "@/events";
import { ModioApi } from "@/apis/modio";
import { ModcatApi, MODCAT_PLATFORM } from "@/apis/modcat";
import { ModSourceType } from "@/models/mod/types";
import { TimeUtils } from "@/utils/TimeUtils.ts";
import { StorageAPI } from "@/storage";
import { ModMapper } from "@/mappers/ModMapper";
import { IntegrateApi } from "@/apis/IntegrateApi";
import StatusBar from "@/components/StatusBar.tsx";
import type { CompleteModData } from "@/storage/dao/ModDAO";
import type { ModInfo } from "@/apis/modio/ModInfo";
import { taskQueueAPI, TaskPriority } from "tauri-plugin-task-queue";
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
    private static lastEmittedProgress = new Map<number, number>();

    public static isOnlineMod(mod: CompleteModData): boolean {
        return mod.sourceType === ModSourceType.Modio ||
            mod.sourceType === MODCAT_PLATFORM ||
            mod.sourceType === "modcat";
    }

    public static async needsOnlineModDownload(mod: CompleteModData): Promise<boolean> {
        const cachePath = mod.download?.cachePath || "";
        const pathExists = cachePath ? await exists(cachePath) : false;
        const onlineUpdateDate = mod.status?.onlineUpdateDate || 0;
        const lastUpdateDate = mod.status?.lastUpdateDate || 0;
        const downloadProgress = mod.download?.downloadProgress || 0;

        return !cachePath ||
            !pathExists ||
            onlineUpdateDate > lastUpdateDate ||
            downloadProgress !== 100;
    }

    private static async emitDownloadProgress(mod: CompleteModData, loaded: number, total: number): Promise<void> {
        if (!mod.modId) return;

        const safeTotal = total > 0 ? total : (mod.download?.fileSize || 0);
        const raw = safeTotal > 0 ? (loaded / safeTotal) * 100 : 0;
        const progress = Math.max(0, Math.min(100, raw));
        const currentPercent = Math.floor(progress);
        const lastPercent = this.lastEmittedProgress.get(mod.modId);

        // 避免高频事件刷屏：仅在整数百分比变化时刷新 UI
        if (lastPercent === currentPercent && currentPercent < 100) {
            return;
        }
        this.lastEmittedProgress.set(mod.modId, currentPercent);

        const updatedMod: CompleteModData = {
            ...mod,
            download: {
                ...(mod.download ?? {
                    modId: mod.modId,
                    downloadUrl: "",
                    cachePath: "",
                    downloadProgress: 0,
                    fileSize: safeTotal,
                    downloadStatus: "downloading"
                }),
                fileSize: safeTotal,
                downloadProgress: progress,
                downloadStatus: progress >= 100 ? "completed" : "downloading"
            }
        };

        await emitEvent("mod-treeview-update", {
            modId: updatedMod.modId!,
            data: updatedMod
        });
    }

    /**
     * 批量刷新 Modio 元数据（支持 platformId 与 nameId 双通道）。
     * @param modioMods Modio 模组列表
     * @param options.fetchTags 是否刷新标签（下载前刷新建议开启）
     * @param options.showStatus 是否显示逐条状态栏提示
     */
    private static async refreshModioMetadataBatch(
        modioMods: CompleteModData[],
        options: { fetchTags?: boolean; showStatus?: boolean } = {}
    ): Promise<{ refreshedMods: CompleteModData[]; errors: Array<{ mod: CompleteModData; error: Error }> }> {
        if (modioMods.length === 0) {
            return { refreshedMods: [], errors: [] };
        }

        const { fetchTags = false, showStatus = false } = options;
        const modsApi = await StorageAPI.getMods();
        const refreshedMods: CompleteModData[] = [];
        const errors: Array<{ mod: CompleteModData; error: Error }> = [];

        const validModioMods = modioMods.filter(m => (m.platformId || 0) > 0);
        const unresolvedIdMods = modioMods.filter(m => (m.platformId || 0) <= 0);
        const platformIds = validModioMods.map(m => m.platformId);
        const unresolvedNameIds = unresolvedIdMods
            .map(m => m.nameId)
            .filter((nameId): nameId is string => !!nameId);

        let modInfoList: ModInfo[] | null = null;
        let unresolvedInfoList: ModInfo[] | null = null;
        try {
            modInfoList = await ModioApi.getModInfoByIdList(platformIds);
            if (unresolvedNameIds.length > 0) {
                unresolvedInfoList = await ModioApi.getModInfoByNameList(unresolvedNameIds);
            }
        } catch (e) {
            console.error("批量获取 Modio 模组信息失败（可能是网络错误）:", e);
            // 网络错误时不标记任何 mod 为不可用，避免误显示「无法获取或已被删除」
        }

        const modInfoMap = modInfoList !== null ? new Map(modInfoList.map(m => [m.id, m])) : null;
        const unresolvedInfoMap = unresolvedInfoList !== null
            ? new Map(unresolvedInfoList.map(m => [m.name_id, m]))
            : null;

        for (const mod of modioMods) {
            try {
                if (showStatus) {
                    await StatusBar.info(t("Batch updating mod info", { name: mod.displayName }));
                }

                const modInfoByPlatformId = mod.platformId > 0 ? modInfoMap?.get(mod.platformId) : undefined;
                const modInfoByNameId = mod.nameId ? unresolvedInfoMap?.get(mod.nameId) : undefined;
                const modInfo = modInfoByPlatformId || modInfoByNameId;
                if (modInfo) {
                    if (fetchTags) {
                        // 列表接口可能不返回 tags 或需刷新，一键更新时拉取最新标签（issue #62）
                        const platformId = modInfo.id || mod.platformId;
                        const tagList = platformId > 0 ? await ModioApi.getModTags(platformId) : [];
                        if (tagList.length > 0) {
                            modInfo.tags = tagList;
                        }
                    }
                    await this.updateModInDatabase(mod.modId!, modInfo);
                } else if (modInfoMap !== null && mod.platformId > 0) {
                    // 仅当 API 成功返回且该 mod 不在列表中时，才标记为不可用（被删除等）
                    await this.markModUnavailable(mod.modId!);
                }

                const refreshed = await modsApi.getCompleteModData(mod.modId!);
                if (refreshed) {
                    await emitEvent("mod-treeview-update", { modId: refreshed.modId!, data: refreshed });
                    refreshedMods.push(refreshed);
                } else {
                    refreshedMods.push(mod);
                }
            } catch (e) {
                errors.push({
                    mod,
                    error: e instanceof Error ? e : new Error(String(e))
                });
                refreshedMods.push(mod);
            }
        }

        return { refreshedMods, errors };
    }

    /**
     * 更新单个模组（刷新元数据 + 下载）
     * 复用 updateModMetadataOnly + updateModFile，避免重复逻辑
     */
    public static async updateMod(mod: CompleteModData) {
        await StatusBar.info(`${t("Update Mod")} [${mod.displayName}]`);
        const refreshed = await this.updateModMetadataOnly(mod);
        if (refreshed) {
            await this.updateModFile(refreshed);
        }
        await StatusBar.success(`${t("Update Finish")}: ${mod.displayName}`);
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

        await StatusBar.info(t("Batch Download Friendly", { count: mods.length, concurrency }));

        // 立即将批量任务标记为 0%，避免进度条要等到首个下载回调后才出现
        for (const mod of mods) {
            if (!mod.modId) continue;
            this.lastEmittedProgress.set(mod.modId, 0);
            await emitEvent("mod-treeview-update", {
                modId: mod.modId,
                data: {
                    ...mod,
                    download: {
                        ...(mod.download ?? {
                            modId: mod.modId,
                            downloadUrl: "",
                            cachePath: "",
                            downloadProgress: 0,
                            fileSize: 0,
                            downloadStatus: "downloading"
                        }),
                        downloadProgress: 0,
                        downloadStatus: "downloading"
                    }
                }
            });
        }

        // 安装前先刷新元数据（获取最新下载链接）；Modio 批量拉取，ModCat 逐个
        const modioMods = mods.filter(m => m.sourceType === ModSourceType.Modio);
        const modcatMods = mods.filter(m => m.sourceType === MODCAT_PLATFORM || m.sourceType === "modcat");
        const otherMods = mods.filter(m => !modioMods.includes(m) && !modcatMods.includes(m));
        const modsToDownload: CompleteModData[] = [];

        if (modioMods.length > 0) {
            const { refreshedMods } = await this.refreshModioMetadataBatch(modioMods, {
                fetchTags: true,
                showStatus: true
            });
            modsToDownload.push(...refreshedMods);
        }
        for (const mod of modcatMods) {
            await StatusBar.info(t("Batch updating mod info", { name: mod.displayName }));
            const refreshed = await this.updateModMetadataOnly(mod);
            modsToDownload.push(refreshed ?? mod);
        }
        modsToDownload.push(...otherMods);

        const { errors } = await asyncPoolAll(
            modsToDownload,
            async (mod) => {
                await StatusBar.info(t("Batch downloading mod", { name: mod.displayName }));
                await this.updateModFile(mod);
                return mod;
            },
            concurrency
        );

        const successCount = mods.length - errors.length;

        if (errors.length > 0) {
            await StatusBar.error(
                t("Batch Download Failed Summary", {
                    success: successCount,
                    total: mods.length,
                    failed: errors.length
                })
            );
        } else {
            await StatusBar.success(t("Batch Download Finish With Count", { count: mods.length }));
        }

        // 清除进度缓存并通知 UI 刷新，避免虚拟列表下未挂载的组件遗留 "0.00%" 标签
        for (const mod of mods) {
            if (mod.modId) this.lastEmittedProgress.delete(mod.modId);
        }
        await emitEvent("batch-download-complete", { modIds: mods.map(m => m.modId!).filter(Boolean) });

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

        const platformId = modInfo.id || modData.platformId || 0;
        // 优先使用 API 返回的原始标签；若 API 未返回则尝试单独拉取
        const hasApiTags = modInfo.tags && Array.isArray(modInfo.tags) && modInfo.tags.length > 0;
        let rawTagNames: string[] = hasApiTags
            ? modInfo.tags.map((tag: any) => tag.name)
            : [];
        if (rawTagNames.length === 0 && platformId > 0) {
            const tagList = await ModioApi.getModTags(platformId);
            if (tagList.length > 0) {
                rawTagNames = tagList.map(tag => tag.name);
            }
        }
        const updatePayload: any = {
            platformId,
            nameId: modInfo.name_id || modData.nameId,
            url: modInfo.profile_url || modData.url,
            originalName: remoteName || modData.originalName,
        };
        // 只有拿到原始标签（含审核/版本信息）时才更新 tags 和 approvalStatus，避免用已过滤的 DB tags 覆盖
        if (rawTagNames.length > 0) {
            const parsed = ModMapper.parseTags(rawTagNames);
            updatePayload.tags = parsed.tags;
            updatePayload.approvalStatus = parsed.approval;
        }

        // Update basic mod info
        await modsApi.updateMod(modId, updatePayload);

        // Update version info — 从原始标签中提取版本列表，不再硬编码为空
        const extractedVersions = rawTagNames.length > 0
            ? ModMapper.extractVersions(rawTagNames)
            : (modData as any).version?.availableVersions || [];
        await modsApi.upsertModVersion({
            modId: modId,
            currentVersion: modInfo.modfile?.version || modInfo.modfile?.filename || "-",
            availableVersions: extractedVersions
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
     * 仅更新模组元数据（版本、下载 URL 等）到数据库，不下载文件。
     * 用于添加 mod 时只落库元数据，或安装前刷新过期下载链接。
     */
    public static async updateModMetadataOnly(mod: CompleteModData): Promise<CompleteModData | null> {
        if (mod.sourceType === MODCAT_PLATFORM || mod.sourceType === "modcat") {
            await this.updateModcatMetadataOnly(mod);
            const modsApi = await StorageAPI.getMods();
            return modsApi.getCompleteModData(mod.modId!);
        }
        const resp = await ModioApi.getModInfoByLink(mod.url || "");
        if (!resp) {
            const modsApi = await StorageAPI.getMods();
            await modsApi.upsertModStatus({
                modId: mod.modId!,
                isOnlineAvailable: false
            });
            const updated = await modsApi.getCompleteModData(mod.modId!);
            if (updated) {
                await emitEvent("mod-treeview-update", { modId: updated.modId!, data: updated });
            }
            return updated;
        }
        await this.updateModInDatabase(mod.modId!, resp);
        const modsApi = await StorageAPI.getMods();
        const updated = await modsApi.getCompleteModData(mod.modId!);
        if (updated) {
            await emitEvent("mod-treeview-update", { modId: updated.modId!, data: updated });
        }
        return updated;
    }

    /**
     * 仅刷新在线模组元数据（不下载文件）
     * 用于“更新列表”场景，确保版本号与 platformId 修复后刷新到 UI。
     */
    public static async refreshOnlineMetadata(
        mods: CompleteModData[],
        concurrency: number = 3,
        options: { fetchTags?: boolean; showStatus?: boolean } = {}
    ): Promise<{ successCount: number; errors: Array<{ mod: CompleteModData; error: Error }> }> {
        const modioMods = mods.filter(m => m.sourceType === ModSourceType.Modio);
        const modcatMods = mods.filter(m => m.sourceType === MODCAT_PLATFORM || m.sourceType === "modcat");
        const totalOnlineCount = modioMods.length + modcatMods.length;
        if (totalOnlineCount === 0) {
            return { successCount: 0, errors: [] };
        }

        const { fetchTags = false, showStatus = true } = options;

        if (showStatus) {
            await StatusBar.info(t("Batch updating mod count", { count: totalOnlineCount }));
        }

        const collectedErrors: Array<{ mod: CompleteModData; error: Error }> = [];

        if (modioMods.length > 0) {
            const { errors } = await this.refreshModioMetadataBatch(modioMods, {
                fetchTags,
                showStatus
            });
            collectedErrors.push(...errors);
        }

        if (modcatMods.length > 0) {
            const { errors } = await asyncPoolAll(
                modcatMods,
                async (mod) => {
                    if (showStatus) {
                        await StatusBar.info(t("Batch updating mod info", { name: mod.displayName }));
                    }
                    await this.updateModMetadataOnly(mod);
                    return mod;
                },
                concurrency
            );
            collectedErrors.push(...errors.map(e => ({ mod: e.item, error: e.error })));
        }

        return {
            successCount: totalOnlineCount - collectedErrors.length,
            errors: collectedErrors
        };
    }

    private static async updateModcatMetadataOnly(mod: CompleteModData): Promise<void> {
        const modsApi = await StorageAPI.getMods();
        const modId = mod.nameId;
        if (!modId) {
            await modsApi.upsertModStatus({ modId: mod.modId!, isOnlineAvailable: false });
            return;
        }
        const modDetail = await ModcatApi.getModDetail(modId);
        if (!modDetail) {
            await modsApi.upsertModStatus({ modId: mod.modId!, isOnlineAvailable: false });
            return;
        }
        const latestVersion = modDetail.ModVersionEntities
            ?.filter(v => v.Status === "Approved" && v.FilesId)
            .sort((a, b) => {
                const dateA = new Date(a.CreatedAt || 0).getTime();
                const dateB = new Date(b.CreatedAt || 0).getTime();
                return dateB - dateA;
            })[0];
        // ModCat 版本列表
        const modcatVersions = modDetail.ModVersionEntities
            ?.filter(v => v.FilesId)
            .map(v => v.VersionNumber || "")
            .filter(Boolean) || [];
        await modsApi.upsertModVersion({
            modId: mod.modId!,
            currentVersion: latestVersion?.VersionNumber || mod.version?.currentVersion || "-",
            availableVersions: modcatVersions
        });
        if (latestVersion?.FilesId) {
            await modsApi.upsertModDownload({
                modId: mod.modId!,
                downloadUrl: ModcatApi.getDownloadUrl(latestVersion.FilesId),
                fileSize: parseInt(latestVersion.Files?.Size || "0", 10)
            });
        }
        const onlineUpdateDate = latestVersion?.UpdatedAt
            ? new Date(latestVersion.UpdatedAt).getTime()
            : TimeUtils.now();
        await modsApi.upsertModStatus({
            modId: mod.modId!,
            onlineUpdateDate,
            isOnlineAvailable: true
        });
        const rawTags = modDetail.ModTypeEntities?.map(t => t.Types?.TypeName).filter(Boolean) as string[] ?? [];
        if (rawTags.length > 0) {
            const parsed = ModMapper.parseTags(rawTags);
            await modsApi.updateMod(mod.modId!, {
                tags: parsed.tags,
                approvalStatus: parsed.approval
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
                await this.emitDownloadProgress(mod, loaded, total);
            });
            cachePath = newItem.download?.cachePath || "";
        }

        // Validate downloaded file is a valid ZIP before persisting
        if (cachePath && await exists(cachePath)) {
            if (!await IntegrateApi.validateZipFile(cachePath)) {
                try { await remove(cachePath); } catch (_) { /* best effort */ }
                throw new Error(`${t("Downloaded file is corrupted")}: ${mod.displayName}`);
            }
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
        if (mod.modId) {
            this.lastEmittedProgress.delete(mod.modId);
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
            await this.emitDownloadProgress(mod, loaded, total);
        });

        return result.cachePath || "";
    }

    /**
     * 检查在线模组并更新
     * 支持 Modio 和 ModCat 两种在线来源
     */
    public static async checkOnlineModAndUpdate(modItem: CompleteModData, isEnabled: boolean) {
        if (!isEnabled || !this.isOnlineMod(modItem)) {
            return;
        }

        const refreshedMod = await this.updateModMetadataOnly(modItem);
        if (!refreshedMod || refreshedMod.status?.isOnlineAvailable === false) {
            return;
        }

        if (await this.needsOnlineModDownload(refreshedMod)) {
            await this.updateModFile(refreshedMod);
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
