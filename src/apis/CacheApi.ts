import {writeFile, size, exists, mkdir} from "@tauri-apps/plugin-fs";
import {appCacheDir} from '@tauri-apps/api/path';
import {path} from "@tauri-apps/api";

const IS_DEV = window.location.host === "127.0.0.1";
const DEV_PATH = "~/Desktop/data/";


class CacheApi {

    public constructor() {
    }

    public static async getModCachePath(modName: string) {
        const appCachePath = await appCacheDir();
        if (!await exists(appCachePath)) {
            await mkdir(appCachePath)
        }
        const cachePath = IS_DEV ? DEV_PATH : appCachePath;
        return await path.join(cachePath, `${modName}.zip`);
    }

    public static async saveCacheFile(modName: string, data: Uint8Array): Promise<any> {
        try {
            const fileName = await CacheApi.getModCachePath(modName);
            await writeFile(fileName, data);
            return fileName;
        } catch (error) {
            console.error(`Failed to write file ${modName}: ${error}`);
        }
    }

    public static async checkCacheFile(modName: string, fileSize: number): Promise<boolean> {
        try {
            const fileName = await CacheApi.getModCachePath(modName);
            const _fileSize = await size(fileName);
            if (_fileSize === fileSize) {
                return true;
            }
        } catch (error) {
            console.error(error);
        }
        return false;
    }

}

export default CacheApi;