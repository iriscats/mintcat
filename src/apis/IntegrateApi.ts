import {t} from "i18next";
import {message} from "antd";
import { emitEvent, onceEvent } from "@/events";
import type { EventPayload } from "@/events";
import {invoke} from '@tauri-apps/api/core';
import {exists} from "@tauri-apps/plugin-fs";
import {StorageAPI} from "@/storage";
import { taskQueueAPI, TaskPriority } from "tauri-plugin-task-queue";

const DEFAULT_STEAM_APP_ID = 548430;
const STEAM_APP_IDS: Record<string, number> = {
    drg: DEFAULT_STEAM_APP_ID,
    rc: 2605790,
};

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
            await emitEvent("app-error", t("error.noPermissionGamePath"));
            return false;
        }

        return true;
    }

    public static async install(
        gamePath: string,
        modListJson: string,
        skipUe4ss: boolean = false,
        ue4ssZipPath?: string,
        drgZipPath?: string,
        rcZipPath?: string
    ) {
        return new Promise<boolean>(async (resolve, reject) => {
            await invoke('install_mods', {
                gamePath: gamePath,
                modListJson: modListJson,
                skipUe4ss: skipUe4ss,
                ue4ssZipPath: ue4ssZipPath ?? null,
                drgZipPath: drgZipPath ?? null,
                rcZipPath: rcZipPath ?? null,
            });

            await onceEvent('install-success', async () => {
                resolve(true);
            });
            await onceEvent('install-error', async (errorMsg) => {
                await emitEvent("status-bar-percent", 0);
                const payload = errorMsg ?? "Unknown error";
                await emitEvent("app-error", payload as EventPayload<'app-error'>);
                let normalized: string;
                if (typeof payload === 'string') {
                    const raw = payload === 'Load failed' ? 'error.release_check_network' : payload;
                    const translated = t(raw);
                    normalized = translated !== raw ? translated : raw;
                } else {
                    const { key, ...params } = payload;
                    const translated = t(key, params as Record<string, unknown>);
                    normalized = translated !== key ? translated : key;
                }
                reject(new Error(normalized));
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

    /**
     * Check if game Paks directory contains .pak files that are neither game nor MintCat-generated.
     * @returns { hasForeign: boolean, fileNames: string[] } fileNames are the foreign .pak base names.
     */
    public static async checkForeignPaksInPaksDir(gamePath: string): Promise<{ hasForeign: boolean; fileNames: string[] }> {
        const fileNames = await invoke<string[]>('check_foreign_paks_in_paks_dir', { gamePath });
        return { hasForeign: fileNames.length > 0, fileNames };
    }

    public static async launchGame() {
        const gameDAO = await StorageAPI.getGames();
        const activeGame = await gameDAO.getActiveGame();
        const gameName = activeGame?.name?.toLowerCase();
        const steamAppId = gameName ? STEAM_APP_IDS[gameName] ?? DEFAULT_STEAM_APP_ID : DEFAULT_STEAM_APP_ID;
        return await invoke('launch_steam_game', { steamAppId });
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

    public static async validateZipFile(path: string): Promise<boolean> {
        return await invoke<boolean>('validate_zip_file', { path });
    }

    public static async openDevTools() {
        return await invoke('open_devtools');
    }

}
