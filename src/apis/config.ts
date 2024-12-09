import {invoke} from '@tauri-apps/api/core';


async function getConfig() {
    return await invoke('my_custom_command');
}
