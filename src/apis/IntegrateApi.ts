import {t} from "i18next";
import {message} from "antd";
import {emit, once} from "@tauri-apps/api/event";
import {invoke} from '@tauri-apps/api/core';
import {exists} from "@tauri-apps/plugin-fs";
import {ModUpdateApi} from "./ModUpdateApi.ts";
import {MessageBox} from "../components/MessageBox.ts";
import {HomeViewModel} from "../vm/HomeViewModel.ts";
import {AppViewModel} from "../vm/AppViewModel.ts";
import {ILock} from "./ILock.ts";
import {ConfigApi} from "./ConfigApi.ts";
import {TimeUtils} from "../utils/TimeUtils.ts";


export class IntegrateApi extends ILock {

    public static async checkGamePath(drgPakPath: string = undefined): Promise<boolean> {
        if (drgPakPath === undefined) {
            const appViewModel = await AppViewModel.getInstance();
            drgPakPath = appViewModel.setting.drgPakPath;
        }

        try {
            if (!await exists(drgPakPath)) {
                //TODO
/*              const found = await this.findGamePak();
                if (found !== undefined) {
                    appViewModel.setting.drgPakPath = found;
                    await ConfigApi.saveSettings(appViewModel.setting.toJson());
                    return true;
                }*/
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

            const appViewModel = await AppViewModel.getInstance();
            const homeViewModel = await HomeViewModel.getInstance();

            if (!await IntegrateApi.checkGamePath()) {
                return false;
            }

            let editTime = homeViewModel.ActiveProfile.editTime;
            let installTime = homeViewModel.ActiveProfile.installTime;
            const subModList = homeViewModel.ActiveProfile.getModList(homeViewModel.ModList);
            for (const item of subModList.Mods) {
                if (item.enabled) {
                    await ModUpdateApi.checkOnlineModUpdate(item);
                    if (await ModUpdateApi.checkLocalModModify(item)) {
                        editTime = TimeUtils.getCurrentTime();
                        homeViewModel.ActiveProfile.editTime = editTime;
                        await ConfigApi.saveProfileDetails(homeViewModel.ActiveProfileName, homeViewModel.ActiveProfile, true);
                    }
                    if (!await ModUpdateApi.checkLocalModCache(item)) {
                        return false;
                    }
                }
            }

            if (installTime < editTime) {
                installTime = editTime;
            }
            const installType = await IntegrateApi.checkInstalled(
                appViewModel.setting.drgPakPath,
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

            await IntegrateApi.uninstall(appViewModel.setting.drgPakPath);

            const installModList = [];
            for (const item of subModList.Mods) {
                const modName = item.nameId === "" ? item.displayName : item.nameId;
                if (item.enabled) {
                    installModList.push({
                        name: modName,
                        modio_id: item.modId,
                        pak_path: item.cachePath,
                    });
                }
            }

            return await IntegrateApi.install(appViewModel.setting.drgPakPath, JSON.stringify(installModList));
        } finally {
            release();
        }
    }

    public static async uninstallMods() {
        const appViewModel = await AppViewModel.getInstance();
        if (!await IntegrateApi.checkGamePath()) {
            return false;
        }
        if (await IntegrateApi.uninstall(appViewModel.setting.drgPakPath)) {
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
                const homeViewModel = await HomeViewModel.getInstance();
                homeViewModel.ActiveProfile.installTime = event.payload;
                await ConfigApi.saveProfileDetails(homeViewModel.ActiveProfileName, homeViewModel.ActiveProfile, true);
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

    private static async uninstall(gamePath: string) {
        return await invoke('uninstall_mods', {
            gamePath: gamePath,
        });
    }

    public static async findGamePak(): Promise<string> {
        return await invoke('find_game_pak');
    }

    public static async launchGame() {
        return await invoke('launch_game');
    }

    public static async isFirstRun(): Promise<boolean> {
        try {
            return await invoke('is_first_run');
        } catch (error) {
            return false;
        }
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


