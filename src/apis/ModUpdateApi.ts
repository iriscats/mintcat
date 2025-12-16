import {t} from "i18next";
import {exists, stat} from "@tauri-apps/plugin-fs";
import {emit} from "@tauri-apps/api/event";
import {ModioApi} from "@/apis/modio";
import {TreeViewModel} from "@/pages/HomePage/TreeViewModel.ts";
import {ProfileViewModel} from "@/dialogs/ProfileEditDialog/ProfileViewModel.ts";
import {MOD_INVALID_ID, ModSourceType, ModListItem} from "@/storage/db/Schema.ts";
import {TimeUtils} from "@/utils/TimeUtils.ts";
import {StorageAPI} from "@/storage";

export class ModUpdateApi {

    private static loading = false;

    public static async updateMod(mod: ModListItem) {
        const resp = await ModioApi.getModInfoByLink(mod.url);
        if (!resp) {
            mod.onlineAvailable = false;
            await emit("mod-treeview-update" + mod.id, mod);
            return;
        }

        // Update mod in database
        await this.updateModInDatabase(mod.id, resp);

        TreeViewModel.updateTreeView();
        await emit("status-bar-log", `${t("Update Mod")} [${mod.displayName}]`);

        await this.updateModFile(mod);

        await emit("status-bar-log", t("Update Finish"));
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
    }

    public static async updateModFile(mod: ModListItem) {
        const newItem = await ModioApi.downloadModFile(mod, async (loaded: number, total: number) => {
            await emit("status-bar-log", `${t("Downloading")} [${mod.displayName}] (${loaded} / ${total})`);
            mod.downloadProgress = (loaded / total) * 100;
            await emit("mod-treeview-update" + mod.id, mod);
        });

        // Update download progress in database
        const modsApi = await StorageAPI.getMods();
        await modsApi.updateDownloadProgress(mod.id, mod.downloadProgress);

        await emit("status-bar-log", t("Update Finish"));
    }

    public static async checkOnlineModUpdate(modItem: ModListItem) {
        if (modItem.sourceType === ModSourceType.Modio &&
            //modItem.onlineAvailable === true &&
            modItem.enabled === true
        ) {
            if (!await exists(modItem.cachePath) ||
                modItem.onlineUpdateDate > modItem.lastUpdateDate ||
                modItem.downloadProgress != 100
            ) {
                await ModUpdateApi.updateMod(modItem);
            }
        }
    }

    public static async checkLocalModCache(modItem: ModListItem) {
        if (modItem.sourceType === ModSourceType.Local) {
            if (!await exists(modItem.cachePath)) {
                modItem.localNoFound = true;
                await emit("mod-treeview-update" + modItem.id, modItem);
                return false;
            } else {
                modItem.localNoFound = false;
            }

            await emit("mod-treeview-update" + modItem.id, modItem);
        }
        return true;
    }

    public static async checkLocalModModify(modItem: ModListItem) {
        if (modItem.sourceType === ModSourceType.Local && modItem.enabled === true) {
            if (await exists(modItem.cachePath)) {
                const fileInfo = await stat(modItem.cachePath);
                const mtime = TimeUtils.getTimeSecond(fileInfo.mtime.getTime());
                if (mtime === modItem.lastUpdateDate) {
                    return false;
                } else {
                    modItem.lastUpdateDate = mtime;
                    await emit("mod-treeview-update" + modItem.id, modItem);
                    return true;
                }
            }
        }
        return false;
    }

    public static async checkModList() {
        await emit("home-page-loading", true);
        ModUpdateApi.loading = true;

        const viewModel = await TreeViewModel.getInstance();
        const modsApi = await StorageAPI.getMods();
        const allMods = await modsApi.getAllMods();

        for (const mod of allMods) {
            // We would need to check if mod is enabled in profile
            // For now, just check cache for local mods
            const modItem: ModListItem = {
                id: mod.modId!,
                modId: mod.platformId,
                url: mod.url || "",
                nameId: mod.nameId,
                displayName: mod.displayName,
                required: false,
                enabled: true,
                fileVersion: "-",
                tags: mod.tags || [],
                usedVersion: "",
                versions: [],
                approval: mod.approvalStatus || "Sandbox",
                sourceType: mod.sourceType as ModSourceType || ModSourceType.Unknown,
                downloadUrl: "",
                cachePath: "",
                downloadProgress: 100,
                fileSize: 0,
                lastUpdateDate: 0,
                onlineUpdateDate: 0,
                onlineAvailable: true,
                localNoFound: false
            };

            await this.checkLocalModCache(modItem);
        }

        ModUpdateApi.loading = false;
        await emit("home-page-loading", false);
        return true;
    }

    public static async checkModUpdate() {
        await emit("status-bar-log", t("Mod Update Check Start"));
        if (ModUpdateApi.loading) {
            return;
        }

        const profileVM = await ProfileViewModel.getInstance();
        let updateTime = 0;
        if (!profileVM.ActiveProfile.lastUpdate) {
            updateTime = TimeUtils.getCurrentTime() - 60 * 60 * 24 * 30; // 最近 1 一个月的更新
        } else {
            updateTime = profileVM.ActiveProfile.lastUpdate;
        }

        const modsApi = await StorageAPI.getMods();
        const allMods = await modsApi.getAllMods();
        const modIdList = [];
        for (const mod of allMods) {
            if (mod.sourceType === ModSourceType.Modio || mod.platformId !== MOD_INVALID_ID) {
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
                        await modsApi.upsertModStatus({
                            modId: mod.modId!,
                            onlineUpdateDate: event.date_added,
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
                        await modsApi.upsertModStatus({
                            modId: mod.modId!,
                            isOnlineAvailable: false,
                            lastUpdateDate: event.date_added,
                            onlineUpdateDate: event.date_added
                        });
                    }
                }
                    break;
            }
        }

        profileVM.ActiveProfile.lastUpdate = TimeUtils.getCurrentTime();
        TreeViewModel.updateTreeView();

        await emit("status-bar-log", t("Mod Update Check Finish"));
    }


}
