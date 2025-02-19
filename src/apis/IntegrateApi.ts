import {invoke} from '@tauri-apps/api/core';


class IntegrateApi {

    public static async Install() {
        return await invoke('my_custom_command');
    }

    public static async Uninstall() {
        return await invoke('my_custom_command');
    }

    public static async LocateGamePath() {
        return await invoke('my_custom_command');
    }

}