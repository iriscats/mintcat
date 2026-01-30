import {writeFile, size, exists, mkdir, remove} from "@tauri-apps/plugin-fs";
import {cacheDir} from '@tauri-apps/api/path';
import {path} from "@tauri-apps/api";
import {convertFileSrc} from "@tauri-apps/api/core";
import {md5} from "@/utils/CryptApi.ts";
import {NetworkApi} from "@/apis/NetworkApi.ts";
import {StorageAPI} from "@/storage";

export class CacheApi {

    private static cachedPath: string | null = null;

    public constructor() {
    }

    public static async getCacheDir(): Promise<string> {
        if (this.cachedPath) {
            return this.cachedPath;
        }
        const settingDAO = await StorageAPI.getSettings();
        const cachePath = await settingDAO.getCachePath();
        if (!await exists(cachePath)) {
            await mkdir(cachePath)
        }
        this.cachedPath = cachePath;
        return cachePath;
    }

    public static clearCache(): void {
        this.cachedPath = null;
    }

    private static sanitizeFileName(name: string): string {
        const illegalChars = /[\\/:*?"<>|]/g;
        return name.replace(illegalChars, '');
    }

    public static async getModCachePath(modName: string, version: string) {
        const appCachePath = await this.getCacheDir();
        const newNodName = CacheApi.sanitizeFileName(`${modName}-${version}.zip`);
        return await path.join(appCachePath, newNodName);
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

    public static async getAvatarCachePath(userId: number) {
        const appCachePath = await this.getCacheDir();
        const avatarCachePath = await path.join(appCachePath, "avatars");
        if (!await exists(avatarCachePath)) {
            await mkdir(avatarCachePath)
        }
        return await path.join(avatarCachePath, `avatar_${userId}.png`);
    }

    public static async cacheAvatar(userId: number, avatarUrl: string) {
        try {
            const avatarPath = await CacheApi.getAvatarCachePath(userId);
            if (!await exists(avatarPath)) {
                const response = await NetworkApi.get(avatarUrl);
                const data = await response.arrayBuffer();
                const buffer = new Uint8Array(data);
                await writeFile(avatarPath, buffer);
            }
            return convertFileSrc(avatarPath);
        } catch (error) {
            console.error(`Failed to cache avatar for user ${userId}:`, error);
        }
    }

    public static async loadAvatar(userId: number) {
        try {
            const avatarPath = await CacheApi.getAvatarCachePath(userId);
            if (await exists(avatarPath)) {
                return convertFileSrc(avatarPath);
            }
        } catch (error) {
            console.error(`Failed to load avatar for user ${userId}:`, error);
        }
        return null;
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

    /**
     * 清除当前设置的缓存目录
     * 包括 mod 缓存文件、图片缓存和头像缓存
     */
    public static async cleanCurrentCache(): Promise<boolean> {
        try {
            const currentCachePath = await this.getCacheDir();
            if (await exists(currentCachePath)) {
                await remove(currentCachePath, {recursive: true});
                // 重新创建缓存目录
                await mkdir(currentCachePath);
                // 清除缓存路径的内存缓存
                this.clearCache();
            }
            return true;
        } catch (error) {
            console.error(`Failed to clean current cache: ${error}`);
            return false;
        }
    }

}

