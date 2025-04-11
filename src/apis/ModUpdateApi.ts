import {message} from "antd";
import {t} from "i18next";
import {exists} from "@tauri-apps/plugin-fs";
import {ModioApi} from "./ModioApi.ts";
import {ConfigApi} from "./ConfigApi.ts";
import {HomeViewModel} from "../vm/HomeViewModel.ts";
import {MOD_INVALID_ID} from "../vm/config/ModList.ts";

export class ModUpdateApi {

    public static async checkModList() {
        const viewModel = await HomeViewModel.getInstance();
        const subModList = viewModel.ActiveProfile.getModList(viewModel.ModList);
        for (const item of subModList.Mods) {
            if (item.enabled) {
                if (item.isLocal === true) {
                    if (!await exists(item.cachePath)) {
                        message.error(t("File Not Found") + item.cachePath);
                        return false;
                    }
                } else {
                    if (!await exists(item.cachePath)) {
                        const mv = await HomeViewModel.getInstance();
                        await mv.updateMod(item);
                    }
                }
            }
        }
        return true;
    }

    public static async checkModUpdate() {
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

        viewModel.ActiveProfile.lastUpdate = new Date().getTime();
        await ConfigApi.saveProfileDetails(viewModel.ActiveProfileName, viewModel.ActiveProfile.toJson());
        await ConfigApi.saveModListData(viewModel.ModList.toJson());
        await viewModel.updateUI();

        message.info(t("Mod Update Checked"));
    }


}