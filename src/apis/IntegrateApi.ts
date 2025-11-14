import {t} from "i18next";
import {message} from "antd";
import {emit, once} from "@tauri-apps/api/event";
import {invoke} from '@tauri-apps/api/core';
import {exists} from "@tauri-apps/plugin-fs";
import {ModUpdateApi} from "@/apis/ModUpdateApi.ts";
import {MessageBox} from "@/components/MessageBox.ts";
import {TreeViewModel} from "@/pages/HomePage/TreeViewModel.ts";
import {ILock} from "@/utils/ILock.ts";
import {TimeUtils} from "@/utils/TimeUtils.ts";
import {StorageAPI} from "@/storage";
import {ModListItem, ModSourceType} from "@/storage/db/Schema.ts";


export class IntegrateApi extends ILock {

    /**
     * Helper method to get all mods from database as ModListItem array
     */
    private async getAllModsAsList(): Promise<ModListItem[]> {
        const modsApi = await StorageAPI.getMods();
        const allMods = await modsApi.getAllMods();
        return allMods.map(mod => ({
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
        }));
    }


    public static async checkGamePath(drgPakPath: string = undefined): Promise<boolean> {
        const gameDAO = await StorageAPI.getGames();
        if (drgPakPath === undefined) {
            drgPakPath = (await gameDAO.getActiveGame())?.installPath;
        }

        try {
            if (!await exists(drgPakPath)) {
                //TODO: auto found or open game path dialog
                message.error(t("Game Path Not Found"));
                return false;
            }
        } catch (e) {
            message.error(t("No Permission To Access Game Path"));
            return false;
        }

        return true;
    }

    public static async installMods() {
        const release = await this.acquireLock();

        try {
            await emit("status-bar-log", t("Start installation"));

            const treeViewModel = await TreeViewModel.getInstance();
            const settings = await StorageAPI.getSettings();

            if (!await IntegrateApi.checkGamePath()) {
                return false;
            }

            if (await IntegrateApi.checkSteamGame()) {
                await emit("status-bar-log", `${t("Installation Failed")}: ${t("Game Not Closed")}`);
                return false;
            }

            let editTime = treeViewModel.ActiveProfile.editTime;
            let installTime = treeViewModel.ActiveProfile.installTime;
            const api = new IntegrateApi();
            const modList = await api.getAllModsAsList();
            const subModList = treeViewModel.ActiveProfile.getModList(modList);
            for (const item of subModList) {
                if (item.enabled) {
                    await ModUpdateApi.checkOnlineModUpdate(item);
                    if (item.cachePath === "") {
                        message.error(`${t("File Not Found")}: ${item.url}`);
                        return false;
                    }

                    if (await ModUpdateApi.checkLocalModModify(item)) {
                        editTime = TimeUtils.getCurrentTime();
                        treeViewModel.ActiveProfile.editTime = editTime;
                    }
                    if (!await ModUpdateApi.checkLocalModCache(item)) {
                        message.error(`${t("File Not Found")}: ${item.displayName}: ${item.cachePath}`);
                        return false;
                    }
                }
            }

            if (installTime < editTime) {
                installTime = editTime;
            }

            const drgPakPath = await settings.getValue('drgPakPath');
            const ue4ss = await settings.getValue('ue4ss');

            const installType = await IntegrateApi.checkInstalled(
                drgPakPath,
                installTime
            );

            switch (installType) {
                case "old_version_mint_installed": {
                    const result = await MessageBox.confirm({
                        title: t("Installation Warning"),
                        content: t("Detected old version MINT(0.2, 0.3) installation file, do you want to uninstall?"),
                    });
                    if (!result) {
                        message.warning(t("User Cancels Installation"));
                        return false;
                    }
                }
                    break;
                case "mintcat_installed": {
                    await emit("status-bar-log", t("Installation Finish"));
                    message.success(t("Installation Finish"));
                }
                    return true;
            }

            if (ue4ss === "UE4SS-Lite") {
                await IntegrateApi.uninstall(drgPakPath);
            } else {
                await IntegrateApi.uninstall(drgPakPath, false);
            }

            const installModList = [];
            for (const item of subModList) {
                const modName = item.nameId === "" ? item.displayName : item.nameId;
                if (item.enabled) {
                    installModList.push({
                        name: modName,
                        modio_id: item.modId,
                        pak_path: item.cachePath,
                    });
                }
            }

            return await IntegrateApi.install(drgPakPath, JSON.stringify(installModList));
        } finally {
            release();
        }
    }

    public static async uninstallMods() {
        const settings = await StorageAPI.getSettings();
        if (!await IntegrateApi.checkGamePath()) {
            return false;
        }
        const drgPakPath = await settings.getValue('drgPakPath');
        if (await IntegrateApi.uninstall(drgPakPath)) {
            message.success(t("Uninstall Success"));
        }
    }

    private static async install(gamePath: string, modListJson: string) {
        return new Promise<boolean>(async (resolve, reject) => {
            await invoke('install_mods', {
                gamePath: gamePath,
                modListJson: modListJson,
            });

            await once<number>('install-success', async (event) => {
                const treeViewModel = await TreeViewModel.getInstance();
                treeViewModel.ActiveProfile.installTime = event.payload;
                await emit("status-bar-log", t("Installation Finish"));
                resolve(true);
            });
            await once<string>('install-error', async (event) => {
                await emit("status-bar-log", `${t("Installation Failed")} Mod: ${event.payload}`);
                await emit("status-bar-percent", 0);
                reject(false);
            });
        });
    }

    private static async uninstall(gamePath: string, isDeleteUe4ss: boolean = true) {
        return await invoke('uninstall_mods', {
            gamePath: gamePath,
            isDeleteUe4ss: isDeleteUe4ss,
        });
    }

    public static async findGamePak(): Promise<string> {
        return await invoke('find_game_pak');
    }

    public static async launchGame() {
        return await invoke('launch_game');
    }

    public static async checkSteamGame() {
        return await invoke('check_steam_game', {
            exeName: "FSD.exe"
        });
    }

    public static async checkInstalled(gamePath: string, installTime: number): Promise<string> {
        return await invoke('check_installed', {
            gamePath: gamePath,
            installTime: installTime,
        });
    }

    public static async openDevTools() {
        return await invoke('open_devtools');
    }

}


