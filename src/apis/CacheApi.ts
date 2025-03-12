import {writeFile, size, exists, mkdir} from "@tauri-apps/plugin-fs";
import {appDataDir} from '@tauri-apps/api/path';

const IS_DEV = false;
const DEV_PATH = "/Users/bytedance/Desktop/data/";


class CacheApi {

    public constructor() {
    }

    public static async getModCachePath(modName: string) {
        const appDataDirPath = await appDataDir();
        if (!await exists(appDataDirPath)) {
            await mkdir(appDataDirPath)
        }
        const cachePath = IS_DEV ? DEV_PATH : appDataDirPath;
        return `${cachePath}${modName}.zip`;
    }

    public static async saveCacheFile(modName: string, data: Uint8Array): Promise<any> {
        const fileName = await CacheApi.getModCachePath(modName);
        try {
            await writeFile(fileName, data);
            return fileName;
        } catch (error) {
            console.error(`Failed to write file ${modName}: ${error}`);
        }
    }

    public static async checkCacheFile(modName: string, fileSize: number): Promise<boolean> {
        const fileName = await CacheApi.getModCachePath(modName);
        try {
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