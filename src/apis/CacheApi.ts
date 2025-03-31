import {writeFile, size, exists, mkdir, remove} from "@tauri-apps/plugin-fs";
import {appCacheDir, cacheDir} from '@tauri-apps/api/path';
import {path} from "@tauri-apps/api";


export class CacheApi {

    public constructor() {
    }

    public static async getModCachePath(modName: string) {
        const appCachePath = await appCacheDir();
        if (!await exists(appCachePath)) {
            await mkdir(appCachePath)
        }
        return await path.join(appCachePath, `${modName}.zip`);
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


    public static async cleanOldCacheFiles(): Promise<boolean> {
        try {
            const cachePath = await cacheDir();
            const mintCachePath = await path.join(cachePath, "drg-mod-integration", "cache");
            if (await exists(mintCachePath)) {
                await remove(mintCachePath);
            }
            const mintcatCachePath = await path.join(cachePath, "mint", "cache");
            if (await exists(mintcatCachePath)) {
                await remove(mintcatCachePath);
            }
            return true;
        } catch (error) {
            console.error(`Failed to remove file : ${error}`);
            return false;
        }
    }

}
