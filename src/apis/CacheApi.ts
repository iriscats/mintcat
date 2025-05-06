import {writeFile, size, exists, mkdir, remove} from "@tauri-apps/plugin-fs";
import {cacheDir} from '@tauri-apps/api/path';
import {path} from "@tauri-apps/api";
import {convertFileSrc} from "@tauri-apps/api/core";
import {AppViewModel} from "../vm/AppViewModel.ts";
import {md5} from "./CryptApi.ts";
import {NetworkApi} from "@/apis/NetworkApi.ts";

export class CacheApi {

    public constructor() {
    }

    public static async getCacheDir(): Promise<string> {
        const vm = await AppViewModel.getInstance();
        return vm.setting.cachePath;
    }

    public static async getModCachePath(modName: string, version: string) {
        const appCachePath = await this.getCacheDir();
        if (!await exists(appCachePath)) {
            await mkdir(appCachePath)
        }
        return await path.join(appCachePath, `${modName}-${version}.zip`);
    }

    public static async getImageCachePath(url: string) {
        const appCachePath = await this.getCacheDir();
        const imageCachePath = await path.join(appCachePath, "images");
        if (!await exists(imageCachePath)) {
            await mkdir(imageCachePath)
        }
        return await path.join(imageCachePath, `${md5(url)}.png`);
    }

    public static async cacheImage(url: string) {
        try {
            const imgPath = await CacheApi.getImageCachePath(url);
            if (!await exists(imgPath)) {
                const response = await NetworkApi.get(url);
                const data = await response.arrayBuffer();
                const buffer = new Uint8Array(data);
                await writeFile(imgPath, buffer);
            }
            return convertFileSrc(imgPath);
        } catch (error) {
        }
    }

    public static async saveCacheFile(modName: string, version: string, data: Uint8Array): Promise<any> {
        try {
            const fileName = await CacheApi.getModCachePath(modName, version);
            await writeFile(fileName, data);
            return fileName;
        } catch (error) {
            console.error(`Failed to write file ${modName}: ${error}`);
        }
    }

    public static async checkCacheFile(modName: string, version: string, fileSize: number): Promise<boolean> {
        try {
            const fileName = await CacheApi.getModCachePath(modName, version);
            const _fileSize = await size(fileName);
            if (_fileSize === fileSize) {
                return true;
            }
        } catch (_) {
            //console.error(error);
        }
        return false;
    }

    public static async cleanOldCacheFiles(): Promise<boolean> {
        try {
            const cachePath = await cacheDir();
            const mintCachePath = await path.join(cachePath, "drg-mod-integration", "cache");
            if (await exists(mintCachePath)) {
                await remove(mintCachePath, {recursive: true});
            }
            const mintcatCachePath = await path.join(cachePath, "mint", "cache");
            if (await exists(mintcatCachePath)) {
                await remove(mintcatCachePath, {recursive: true});
            }
            return true;
        } catch (error) {
            console.error(`Failed to remove file : ${error}`);
            return false;
        }
    }

}

