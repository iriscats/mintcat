import {t} from "i18next";
import {exists, stat} from "@tauri-apps/plugin-fs";
import {emitEvent} from "@/events";
import {ModioApi} from "@/apis/modio";
import {TreeViewModel} from "@/pages/HomePage/TreeViewModel.ts";
import {ProfileViewModel} from "@/dialogs/ProfileEditDialog/ProfileViewModel.ts";
import { IoC } from "@/core/IoC.ts";
import {ModSourceType} from "@/models/mod/types";
import {TimeUtils} from "@/utils/TimeUtils.ts";
import {StorageAPI} from "@/storage";
import type {CompleteModData} from "@/storage/dao/ModDAO";

export class ModUpdateApi {

    private static loading = false;

    public static async updateMod(mod: CompleteModData) {
        await emitEvent("status-bar-log", `${t("Update Mod")} [${mod.displayName}]`);
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

        TreeViewModel.updateTreeView();
        await emitEvent("status-bar-log", t("Update Finish"));
    }

    /**
     * Update mod information in database
     */
    private static async updateModInDatabase(modId: number, modInfo: any) {
        const modsApi = await StorageAPI.getMods();
        const modData = await modsApi.getModById(modId);
        if (!modData) return;

        // Update basic mod info
        await modsApi.updateMod(modId, {
            displayName: modInfo.name || modData.displayName,
            nameId: modInfo.name_id || modData.nameId,
            url: modInfo.profile_url || modData.url,
            tags: modInfo.tags ? modInfo.tags.map((tag: any) => tag.name) : modData.tags
        });

        // Update version info
        await modsApi.upsertModVersion({
            modId: modId,
            currentVersion: modInfo.modfile?.version || modInfo.modfile?.filename || "-",
            availableVersions: []
        });

        // Update download info
        await modsApi.upsertModDownload({
            modId: modId,
            downloadUrl: modInfo.modfile?.download?.binary_url || "",
            fileSize: modInfo.modfile?.filesize || 0,
            downloadProgress: 0
        });

        // Update status info with current online update date
        // Note: mod.io API returns Unix timestamp in seconds, but we store milliseconds
        const onlineUpdateDate = modInfo.date_updated ? modInfo.date_updated * 1000 : Date.now();
        await modsApi.upsertModStatus({
            modId: modId,
            onlineUpdateDate: onlineUpdateDate,
            isOnlineAvailable: true
        });
    }

    public static async updateModFile(mod: CompleteModData) {
        const newItem = await ModioApi.downloadModFile(mod, async (loaded: number, total: number) => {
            await emitEvent("status-bar-log", `${t("Downloading")} [${mod.displayName}] (${loaded} / ${total})`);
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

        // Update lastUpdateDate to match onlineUpdateDate after successful download
        const currentStatus = await modsApi.getModStatus(mod.modId!);
        if (currentStatus) {
            await modsApi.upsertModStatus({
                modId: mod.modId!,
                lastUpdateDate: currentStatus.onlineUpdateDate || Date.now()
            });
        }

        await emitEvent("status-bar-log", t("Update Finish"));
    }

    public static async checkOnlineModUpdate(modItem: CompleteModData, isEnabled: boolean) {
        if (modItem.sourceType === ModSourceType.Modio && isEnabled) {
            const cachePath = modItem.download?.cachePath || "";
            const onlineUpdateDate = modItem.status?.onlineUpdateDate || 0;
            const lastUpdateDate = modItem.status?.lastUpdateDate || 0;
            const downloadProgress = modItem.download?.downloadProgress || 0;

            if (!await exists(cachePath) ||
                onlineUpdateDate > lastUpdateDate ||
                downloadProgress != 100
            ) {
                await ModUpdateApi.updateMod(modItem);
            }
        }
    }

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

    public static async checkModList() {
        await emitEvent("home-page-loading", true);
        ModUpdateApi.loading = true;

        const viewModel = await IoC.get(TreeViewModel);
        const modsApi = await StorageAPI.getMods();
        const allMods = await modsApi.getAllMods();

        for (const mod of allMods) {
            // Get complete mod data
            const completeModData = await modsApi.getCompleteModData(mod.modId!);
            if (completeModData) {
                await this.checkLocalModCache(completeModData);
            }
        }

        ModUpdateApi.loading = false;
        await emitEvent("home-page-loading", false);
        return true;
    }

    public static async checkModUpdate() {
        await emitEvent("status-bar-log", t("Mod Update Check Start"));
        if (ModUpdateApi.loading) {
            return;
        }

        const profileVM = await IoC.get(ProfileViewModel);
        const lastUpdate = await profileVM.getActiveProfileLastUpdate();
        const updateTime = lastUpdate || (TimeUtils.getCurrentTime() - 60 * 60 * 24 * 30); // 最近 1 一个月的更新

        const modsApi = await StorageAPI.getMods();
        const allMods = await modsApi.getAllMods();
        const modIdList = [];
        for (const mod of allMods) {
            if (mod.sourceType === ModSourceType.Modio) {
                modIdList.push(mod.platformId);
            }
        }

        const events = await ModioApi.getEvents(updateTime, modIdList.join(","));
        for (const event of events) {
            switch (event.event_type) {
                case "MODFILE_CHANGED": {
                    const mod = allMods.find(m => m.platformId === event.mod_id);
                    if (mod) {
                        // Update mod status in database
                        // Note: event.date_added is in seconds, convert to milliseconds
                        await modsApi.upsertModStatus({
                            modId: mod.modId!,
                            onlineUpdateDate: event.date_added * 1000,
                            lastUpdateDate: 0
                        });
                    }
                }
                    break;
                case "MOD_UNAVAILABLE":
                case "MOD_DELETED": {
                    const mod = allMods.find(m => m.platformId === event.mod_id);
                    if (mod) {
                        // Update mod status in database
                        // Note: event.date_added is in seconds, convert to milliseconds
                        await modsApi.upsertModStatus({
                            modId: mod.modId!,
                            isOnlineAvailable: false,
                            lastUpdateDate: event.date_added * 1000,
                            onlineUpdateDate: event.date_added * 1000
                        });
                    }
                }
                    break;
            }
        }

        await profileVM.setActiveProfileLastUpdate(TimeUtils.getCurrentTime());
        TreeViewModel.updateTreeView();

        await emitEvent("status-bar-log", t("Mod Update Check Finish"));
    }


}
