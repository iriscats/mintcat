import {invoke} from '@tauri-apps/api/core';


export class IntegrateApi {

    public static async install(gamePath: string, modListJson: string) {
        console.log(`Install mods: ${gamePath} ${modListJson}`);
        return await invoke('install_mods', {
            gamePath: gamePath,
            modListJson: modListJson,
        });
    }

    public static async uninstall(gamePath: string) {
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

    public static async checkInstalled(gamePath: string): Promise<string> {
        return await invoke('check_installed', {
            gamePath: gamePath,
        });
    }

    public static async openDevTools() {
        return await invoke('open_devtools');
    }

}


