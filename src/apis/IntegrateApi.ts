import {invoke} from '@tauri-apps/api/core';


export class IntegrateApi {

    public static async Install(mod_list: string) {
        console.log("Install mods: " + mod_list);
        return await invoke('install_mods', {
            modListJson: mod_list,
        });
    }

    public static async Uninstall() {
        return await invoke('my_custom_command');
    }

    public static async LocateGamePath() {
        return await invoke('my_custom_command');
    }

}