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
import {TaskManager} from "@/tasks/TaskManager.ts";
import {TaskPriority} from "@/apis/TaskQueueAPI.ts";


export class IntegrateApi extends ILock {

    /**
     * Shared instance for lock mechanism in static methods
     * Ensures only one installation operation runs at a time
     */
    private static lockInstance = new IntegrateApi();

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
                await emit("app-error", t("Game Path Not Found"));
                return false;
            }
        } catch (e) {
            await emit("app-error", t("No Permission To Access Game Path"));
            return false;
        }

        return true;
    }

    /**
     * Install mods to game using async task system
     * @returns Task ID for tracking progress
     *
     * @example
     * ```typescript
     * const taskId = await IntegrateApi.installMods();
     * // UI can listen to task progress via TaskManager.onTaskUpdated()
     * ```
     */
    public static async installMods(): Promise<string> {
        console.log('[IntegrateApi] Submitting mod installation task');

        // Submit install task to TaskManager
        const taskManager = TaskManager.getInstance();
        const taskId = await taskManager.submitFrontendTask(
            'mod_install',
            {}, // ModInstallTask will get active profile automatically
            TaskPriority.High
        );

        console.log(`[IntegrateApi] Install task submitted: ${taskId}`);
        return taskId;
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

    public static async install(gamePath: string, modListJson: string) {
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

    public static async uninstall(gamePath: string, isDeleteUe4ss: boolean = true) {
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


