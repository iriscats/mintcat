import {t} from "i18next";
import {message} from "antd";
import {emitEvent, onceEvent} from "@/events";
import {invoke} from '@tauri-apps/api/core';
import {exists} from "@tauri-apps/plugin-fs";
import {TreeViewModel} from "@/pages/HomePage/TreeViewModel.ts";
import {ProfileViewModel} from "@/dialogs/ProfileEditDialog/ProfileViewModel.ts";
import { IoC } from "@/core/IoC.ts";
import {ILock} from "@/core/ILock.ts";
import {StorageAPI} from "@/storage";
import {ModSourceType} from "@/models/mod/types";
import {TaskManager} from "@/tasks/TaskManager.ts";
import {TaskPriority} from "@/apis/TaskQueueAPI.ts";
import {ModService} from "@/services/ModService.ts";
import type {CompleteModData} from "@/storage/dao/ModDAO";


export class IntegrateApi extends ILock {

    /**
     * Shared instance for lock mechanism in static methods
     * Ensures only one installation operation runs at a time
     */
    private static lockInstance = new IntegrateApi();

    /**
     * Helper method to get all mods from database as CompleteModData array
     */
    private async getAllModsAsList(): Promise<CompleteModData[]> {
        return await ModService.getAllMods();
    }


    public static async checkGamePath(drgPakPath: string = undefined): Promise<boolean> {
        const gameDAO = await StorageAPI.getGames();
        if (drgPakPath === undefined) {
            drgPakPath = (await gameDAO.getActiveGame())?.installPath;
        }

        try {
            if (!await exists(drgPakPath)) {
                //TODO: auto found or open game path dialog
                await emitEvent("app-error", t("Game Path Not Found"));
                return false;
            }
        } catch (e) {
            await emitEvent("app-error", t("No Permission To Access Game Path"));
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
        if (!await IntegrateApi.checkGamePath()) {
            return false;
        }
        const gameDAO = await StorageAPI.getGames();
        const activeGame = await gameDAO.getActiveGame();
        const drgPakPath = activeGame?.installPath;
        if (drgPakPath && await IntegrateApi.uninstall(drgPakPath)) {
            message.success(t("Uninstall Success"));
        }
    }

    public static async install(gamePath: string, modListJson: string) {
        return new Promise<boolean>(async (resolve, reject) => {
            await invoke('install_mods', {
                gamePath: gamePath,
                modListJson: modListJson,
            });

            await onceEvent('install-success', async (installTime) => {
                const profileVM = await IoC.get(ProfileViewModel);
                await profileVM.setActiveProfileInstallTime(installTime);
                await emitEvent("status-bar-log", t("Installation Finish"));
                resolve(true);
            });
            await onceEvent('install-error', async (modName) => {
                await emitEvent("status-bar-log", `${t("Installation Failed")} Mod: ${modName}`);
                await emitEvent("status-bar-percent", 0);
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
