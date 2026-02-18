import {t} from "i18next";
import {message} from "antd";
import { emitEvent, onceEvent } from "@/events";
import type { EventPayload } from "@/events";
import {invoke} from '@tauri-apps/api/core';
import {exists} from "@tauri-apps/plugin-fs";
import {ProfileViewModel} from "@/dialogs/ProfileEditDialog/ProfileViewModel.ts";
import { IoC } from "@/core/IoC.ts";
import {StorageAPI} from "@/storage";
import { taskQueueAPI, TaskPriority } from "tauri-plugin-task-queue-api";


export class IntegrateApi  {

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

        // Submit install task directly to plugin
        const taskId = await taskQueueAPI.addTask({
            taskType: 'mod_install',
            params: {}, 
            priority: TaskPriority.High
        });

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

    public static async install(
        gamePath: string,
        modListJson: string,
        skipUe4ss: boolean = false,
        ue4ssZipPath?: string,
        drgZipPath?: string
    ) {
        return new Promise<boolean>(async (resolve, reject) => {
            await invoke('install_mods', {
                gamePath: gamePath,
                modListJson: modListJson,
                skipUe4ss: skipUe4ss,
                ue4ssZipPath: ue4ssZipPath ?? null,
                drgZipPath: drgZipPath ?? null,
            });

            await onceEvent('install-success', async (installTime) => {
                const profileVM = await IoC.get(ProfileViewModel);
                await profileVM.setActiveProfileInstallTime(installTime);
                resolve(true);
            });
            await onceEvent('install-error', async (errorMsg) => {
                await emitEvent("status-bar-percent", 0);
                const payload = errorMsg ?? "Unknown error";
                await emitEvent("app-error", payload as EventPayload<'app-error'>);
                reject(new Error(typeof payload === 'string' ? payload : payload.key));
            });
        });
    }

    public static async uninstall(gamePath: string, isDeleteUe4ss: boolean = true) {
        return await invoke('uninstall_mods', {
            gamePath: gamePath,
            isDeleteUe4ss: isDeleteUe4ss,
        });
    }

    public static async findGamePak(gameName?: string): Promise<string> {
        return await invoke('find_game_pak', { gameName: gameName ?? null });
    }

    public static async launchGame() {
        const gameDAO = await StorageAPI.getGames();
        const activeGame = await gameDAO.getActiveGame();
        const gameName = activeGame?.name ?? null;
        return await invoke('launch_steam_game', { gameName });
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

    public static async installDotnetRuntime(gamePath: string): Promise<boolean> {
        return await invoke('install_dotnet_runtime', {
            gamePath: gamePath,
        });
    }

    public static async openDevTools() {
        return await invoke('open_devtools');
    }

}
