import {invoke} from '@tauri-apps/api/core';


export class IntegrateApi {

    public static async install(gamePath: string, modListJson: string) {
        console.log(`Install mods: ${gamePath} ${modListJson}`);
        return await invoke('install_mods', {
            gamePath: gamePath,
            modListJson: modListJson,
        });
    }

    public static async uninstall() {
        return await invoke('my_custom_command');
    }

    public static async locateGamePath() {
        return await invoke('my_custom_command');
    }

    public static async launchGame(gamePath: string) {
        return await invoke('my_custom_command');
    }

}


