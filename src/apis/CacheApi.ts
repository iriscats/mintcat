import {writeFile, size, exists, mkdir, remove, readDir, copyFile} from "@tauri-apps/plugin-fs";
import {cacheDir} from '@tauri-apps/api/path';
import {path} from "@tauri-apps/api";
import {convertFileSrc} from "@tauri-apps/api/core";
import {md5} from "@/utils/CryptApi.ts";
import {NetworkApi} from "@/apis/NetworkApi.ts";
import {IntegrateApi} from "@/apis/IntegrateApi.ts";
import {StorageAPI} from "@/storage";

export class CacheApi {

    private static cachedPath: string | null = null;
    private static readonly ownedCacheDirectories = new Set(["images", "avatars"]);
    private static readonly ownedCacheFiles = new Set(["UE4SSL.zip", "DRG.zip", "RC.zip", "assets_manifest.json"]);

    public constructor() {
    }

    public static async getCacheDir(): Promise<string> {
        if (this.cachedPath) {
            return this.cachedPath;
        }
        const settingDAO = await StorageAPI.getSettings();
        const cachePath = await settingDAO.getCachePath();
        if (!await exists(cachePath)) {
            // 使用 recursive: true 确保可以创建多级目录
            await mkdir(cachePath, { recursive: true });
        }
        this.cachedPath = cachePath;
        return cachePath;
    }

    public static clearCache(): void {
        this.cachedPath = null;
    }

    private static sanitizeFileName(name: string): string {
        const illegalChars = /[\\/:*?"<>|\u0000-\u001f]/g;
        const sanitized = name
            .replace(illegalChars, "_")
            .replace(/\s+/g, " ")
            .replace(/[. ]+$/g, "")
            .trim();
        return sanitized || "mod";
    }

    private static legacySanitizeFileName(name: string): string {
        const illegalChars = /[\\/:*?"<>|]/g;
        return name.replace(illegalChars, '');
    }

    private static buildModCacheFileName(modName: string, version: string): string {
        const rawName = `${modName}-${version}`;
        const readableName = CacheApi.sanitizeFileName(rawName).slice(0, 120);
        const fingerprint = md5(rawName).slice(0, 10);
        return `${readableName}-${fingerprint}.zip`;
    }

    private static buildLegacyModCacheFileName(modName: string, version: string): string {
        return CacheApi.legacySanitizeFileName(`${modName}-${version}.zip`);
    }

    public static async getModCachePath(modName: string, version: string) {
        const appCachePath = await this.getCacheDir();
        const newNodName = CacheApi.buildModCacheFileName(modName, version);
        return await path.join(appCachePath, newNodName);
    }

    private static async getLegacyModCachePath(modName: string, version: string) {
        const appCachePath = await this.getCacheDir();
        const legacyName = CacheApi.buildLegacyModCacheFileName(modName, version);
        return await path.join(appCachePath, legacyName);
    }

    public static async getImageCachePath(url: string) {
        const appCachePath = await this.getCacheDir();
        const imageCachePath = await path.join(appCachePath, "images");
        if (!await exists(imageCachePath)) {
            await mkdir(imageCachePath, { recursive: true });
        }
        return await path.join(imageCachePath, `${md5(url)}.png`);
    }

    public static async cacheImage(url: string) {
        try {
            const imgPath = await CacheApi.getImageCachePath(url);
            if (!await exists(imgPath)) {
                const response = await NetworkApi.get(url);
                const contentType = response.headers.get("content-type") || "";
                if (!response.ok || (contentType && !contentType.startsWith("image/"))) {
                    throw new Error(`Invalid image response: ${response.status} ${contentType}`);
                }
                const data = await response.arrayBuffer();
                const buffer = new Uint8Array(data);
                await writeFile(imgPath, buffer);
            }
            return convertFileSrc(imgPath);
        } catch (error) {
            console.error(`Failed to cache image ${url}:`, error);
        }
    }

    public static async getAvatarCachePath(userId: number) {
        const appCachePath = await this.getCacheDir();
        const avatarCachePath = await path.join(appCachePath, "avatars");
        if (!await exists(avatarCachePath)) {
            await mkdir(avatarCachePath, { recursive: true });
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
            if (await CacheApi.isValidCacheFile(fileName, fileSize)) {
                return true;
            }

            const legacyFileName = await CacheApi.getLegacyModCachePath(modName, version);
            if (legacyFileName !== fileName && await CacheApi.isValidCacheFile(legacyFileName, fileSize)) {
                try {
                    await copyFile(legacyFileName, fileName);
                    return true;
                } catch (error) {
                    console.warn(`[CacheApi] Failed to migrate legacy cache file: ${legacyFileName}`, error);
                }
            }
        } catch (_) {
            // File doesn't exist or can't be read
        }
        return false;
    }

    private static async isValidCacheFile(fileName: string, fileSize: number): Promise<boolean> {
        try {
            const _fileSize = await size(fileName);
            if (_fileSize !== fileSize) {
                return false;
            }
            // Size matches — validate ZIP integrity to catch corrupt files
            if (!await IntegrateApi.validateZipFile(fileName)) {
                console.warn(`[CacheApi] Cached file has correct size but is not a valid ZIP: ${fileName}`);
                try { await remove(fileName); } catch (_) { /* best effort */ }
                return false;
            }
            return true;
        } catch (_) {
            return false;
        }
    }

    private static isOwnedCacheEntry(entry: Awaited<ReturnType<typeof readDir>>[number]): boolean {
        const name = entry.name ?? "";
        if (!name) {
            return false;
        }
        if (entry.isDirectory) {
            return CacheApi.ownedCacheDirectories.has(name);
        }
        return CacheApi.ownedCacheFiles.has(name) || name.endsWith(".zip") || name.endsWith(".part");
    }

    private static async removeCacheEntry(cacheDirPath: string, entry: Awaited<ReturnType<typeof readDir>>[number]): Promise<boolean> {
        const name = entry.name ?? "";
        if (!name) {
            return true;
        }
        try {
            const entryPath = await path.join(cacheDirPath, name);
            await remove(entryPath, { recursive: entry.isDirectory });
            return true;
        } catch (error) {
            console.warn(`[CacheApi] Failed to remove cache entry ${name}:`, error);
            return false;
        }
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
     * Remove orphaned .part files left by interrupted downloads.
     * Called at app startup to prevent corrupt resumes.
     */
    public static async cleanOrphanedPartFiles(): Promise<number> {
        let cleaned = 0;
        try {
            const cacheDirPath = await this.getCacheDir();
            const entries = await readDir(cacheDirPath);
            for (const entry of entries) {
                if (entry.isFile && entry.name?.endsWith('.part')) {
                    try {
                        const filePath = await path.join(cacheDirPath, entry.name);
                        await remove(filePath);
                        cleaned++;
                    } catch (_) { /* best effort */ }
                }
            }
            if (cleaned > 0) {
                console.log(`[CacheApi] Cleaned ${cleaned} orphaned .part file(s)`);
            }
        } catch (error) {
            console.warn('[CacheApi] Failed to clean orphaned .part files:', error);
        }
        return cleaned;
    }

    /**
     * 清除当前设置的缓存目录
     * 包括 mod 缓存文件、图片缓存和头像缓存
     */
    public static async cleanCurrentCache(): Promise<boolean> {
        try {
            const currentCachePath = await this.getCacheDir();
            if (!await exists(currentCachePath)) {
                await mkdir(currentCachePath, { recursive: true });
                this.clearCache();
                return true;
            }

            let failedCount = 0;
            const entries = await readDir(currentCachePath);
            for (const entry of entries) {
                if (!CacheApi.isOwnedCacheEntry(entry)) {
                    continue;
                }
                if (!await CacheApi.removeCacheEntry(currentCachePath, entry)) {
                    failedCount++;
                }
            }

            if (failedCount > 0) {
                console.warn(`[CacheApi] ${failedCount} cache entr${failedCount === 1 ? "y" : "ies"} could not be removed`);
            }

            // 清除缓存路径的内存缓存
            this.clearCache();
            return true;
        } catch (error) {
            console.error(`Failed to clean current cache: ${error}`);
            return false;
        }
    }

}

