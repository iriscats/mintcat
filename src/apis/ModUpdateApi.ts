import {message} from "antd";
import {t} from "i18next";
import {exists, stat} from "@tauri-apps/plugin-fs";
import {ModioApi} from "./ModioApi.ts";
import {ConfigApi} from "./ConfigApi.ts";
import {HomeViewModel} from "../vm/HomeViewModel.ts";
import {MOD_INVALID_ID, ModListItem} from "../vm/config/ModList.ts";
import {emit} from "@tauri-apps/api/event";

export class ModUpdateApi {


    public static async updateMod(mod: ModListItem) {
        const viewModel = await HomeViewModel.getInstance();
        const resp = await ModioApi.getModInfoByLink(mod.url);
        if (!resp) {
            throw new Error;
        }

        let newItem = new ModListItem(resp);
        newItem = viewModel.ModList.update(mod, newItem);
        await viewModel.updateUI();
        await emit("status-bar-log", `${t("Update Mod")} [${newItem.displayName}]`);

        newItem = await ModioApi.downloadModFile(newItem, async (loaded: number, total: number) => {
            await emit("status-bar-log", `${t("Downloading")} [${newItem.displayName}] (${loaded} / ${total})`);
            newItem.downloadProgress = (loaded / total) * 100;
            viewModel.ModList.update(mod, newItem);
            await viewModel.updateUI();
        });

        viewModel.ModList.update(mod, newItem);
        await ConfigApi.saveModListData(viewModel.ModList.toJson());
        await emit("status-bar-log", t("Update Finish"));
    }

    public static async checkOnlineModUpdate(modItem: ModListItem) {
        if (modItem.isLocal === false) {
            if (!await exists(modItem.cachePath) || modItem.onlineUpdateDate > modItem.lastUpdateDate) {
                await ModUpdateApi.updateMod(modItem);
            }
        }
    }

    public static async checkLocalModCache(modItem: ModListItem) {
        if (modItem.isLocal === true && modItem.enabled === true) {
            if (!await exists(modItem.cachePath)) {
                message.error(t("File Not Found") + modItem.cachePath);
                return false;
            }
        }
        return true;
    }

    public static async checkLocalModModify(modItem: ModListItem) {
        if (modItem.isLocal === true && modItem.enabled === true) {
            if (await exists(modItem.cachePath)) {
                const fileInfo = await stat(modItem.cachePath);
                if (fileInfo.mtime.getTime() === modItem.lastUpdateDate) {
                    return false;
                }
            }
        }
        return true;
    }

    public static async checkModList() {
        const viewModel = await HomeViewModel.getInstance();
        const subModList = viewModel.ActiveProfile.getModList(viewModel.ModList);
        for (const item of subModList.Mods) {
            if (item.enabled) {
                await this.checkOnlineModUpdate(item);
                if (!await this.checkLocalModModify(item)) {
                    viewModel.ActiveProfile.editTime = 0;
                }
                if (!await this.checkLocalModCache(item)) {
                    return false;
                }
            }
        }
        return true;
    }

    public static async checkModUpdate() {
        await emit("status-bar-log", t("Mod Update Check Start"));

        const viewModel = await HomeViewModel.getInstance();

        let updateTime = 0;
        if (!viewModel.ActiveProfile.lastUpdate) {
            updateTime = Math.round(new Date().getTime() / 1000) - 60 * 60 * 24 * 30; // 最近 1 一个月的更新
        } else {
            updateTime = viewModel.ActiveProfile.lastUpdate;
        }

        const subModList = viewModel.ActiveProfile.getModList(viewModel.ModList);
        const modIdList = [];
        for (const item of subModList.Mods) {
            if (item.isLocal === false || item.modId !== MOD_INVALID_ID) {
                modIdList.push(item.modId);
            }
        }

        const events = await ModioApi.getEvents(updateTime, modIdList.join(","));
        for (const event of events) {
            switch (event.event_type) {
                case "MODFILE_CHANGED": {
                    let modItem = viewModel.ModList.getByModId(event.mod_id);
                    console.log("MODFILE_CHANGED", modItem);
                    if (modItem) {
                        modItem.onlineUpdateDate = event.date_added * 1000;
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
                        modItem.lastUpdateDate = event.date_added * 1000;
                        modItem.onlineUpdateDate = event.date_added * 1000;
                    }
                }
                    break;
            }
        }

        viewModel.ActiveProfile.lastUpdate = Math.round(new Date().getTime() / 1000);
        await ConfigApi.saveProfileDetails(viewModel.ActiveProfileName, viewModel.ActiveProfile);
        await ConfigApi.saveModListData(viewModel.ModList.toJson());
        await viewModel.updateUI();

        await emit("status-bar-log", t("Mod Update Check Finish"));
    }


}