import {t} from "i18next";
import {exists, stat} from "@tauri-apps/plugin-fs";
import {emit} from "@tauri-apps/api/event";
import {ModioApi} from "@/apis/modio";
import {HomeViewModel} from "@/vm/HomeViewModel.ts";
import {MOD_INVALID_ID, ModListItem, ModSourceType} from "@/vm/config/ModList.ts";
import {TimeUtils} from "@/utils/TimeUtils.ts";

export class ModUpdateApi {

    private static loading = false;

    public static async updateMod(mod: ModListItem) {
        const viewModel = await HomeViewModel.getInstance();
        const resp = await ModioApi.getModInfoByLink(mod.url);
        if (!resp) {
            mod.onlineAvailable = false;
            viewModel.ModList.update(mod, mod);
            await emit("mod-treeview-update" + mod.id, mod);
            return;
        }

        let newItem = new ModListItem(resp);
        newItem = viewModel.ModList.update(mod, newItem);

        HomeViewModel.updateTreeView();
        await emit("status-bar-log", `${t("Update Mod")} [${newItem.displayName}]`);

        await this.updateModFile(newItem);

        await emit("status-bar-log", t("Update Finish"));
    }

    public static async updateModFile(mod: ModListItem) {
        const viewModel = await HomeViewModel.getInstance();

        const newItem = await ModioApi.downloadModFile(mod, async (loaded: number, total: number) => {
            await emit("status-bar-log", `${t("Downloading")} [${mod.displayName}] (${loaded} / ${total})`);
            mod.downloadProgress = (loaded / total) * 100;
            await emit("mod-treeview-update" + mod.id, mod);
        });
        viewModel.ModList.update(mod, newItem);

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
                return false;
            } else {
                modItem.localNoFound = false;
            }

            const viewModel = await HomeViewModel.getInstance();
            viewModel.ModList.update(modItem, modItem);

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
                    const viewModel = await HomeViewModel.getInstance();
                    viewModel.ModList.update(modItem, modItem, true);

                    return true;
                }
            }
        }
        return false;
    }

    public static async checkModList() {
        await emit("home-page-loading", true);
        ModUpdateApi.loading = true;

        const viewModel = await HomeViewModel.getInstance();
        const subModList = viewModel.ActiveProfile.getModList(viewModel.ModList);
        for (const item of subModList.Mods) {
            if (item.enabled) {
                await this.checkOnlineModUpdate(item);
                await this.checkLocalModCache(item);
            }
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

        const viewModel = await HomeViewModel.getInstance();
        let updateTime = 0;
        if (!viewModel.ActiveProfile.lastUpdate) {
            updateTime = TimeUtils.getCurrentTime() - 60 * 60 * 24 * 30; // 最近 1 一个月的更新
        } else {
            updateTime = viewModel.ActiveProfile.lastUpdate;
        }

        const subModList = viewModel.ActiveProfile.getModList(viewModel.ModList);
        const modIdList = [];
        for (const item of subModList.Mods) {
            if (item.sourceType === ModSourceType.Modio || item.modId !== MOD_INVALID_ID) {
                modIdList.push(item.modId);
            }
        }

        const events = await ModioApi.getEvents(updateTime, modIdList.join(","));
        for (const event of events) {
            switch (event.event_type) {
                case "MODFILE_CHANGED": {
                    let modItem = viewModel.ModList.getByModId(event.mod_id);
                    if (modItem) {
                        modItem.onlineUpdateDate = event.date_added;
                        if (!modItem.lastUpdateDate) {
                            modItem.lastUpdateDate = 0;
                        }
                    }
                }
                    break;
                case "MOD_UNAVAILABLE":
                case "MOD_DELETED": {
                    let modItem = viewModel.ModList.getByModId(event.mod_id);
                    if (modItem) {
                        modItem.onlineAvailable = false;
                        modItem.lastUpdateDate = event.date_added;
                        modItem.onlineUpdateDate = event.date_added;
                    }
                }
                    break;
            }
        }

        viewModel.ActiveProfile.lastUpdate = TimeUtils.getCurrentTime();
        HomeViewModel.updateTreeView();

        await emit("status-bar-log", t("Mod Update Check Finish"));
    }


}