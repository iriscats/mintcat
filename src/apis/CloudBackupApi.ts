import { readFile, writeFile, exists, stat, remove, copyFile } from "@tauri-apps/plugin-fs";
import { path } from "@tauri-apps/api";
import { configDir } from "@tauri-apps/api/path";
import { getVersion } from "@tauri-apps/api/app";
import { message } from "antd";
import { StorageAPI } from "@/storage";

export interface CloudBackupConfig {
    baseUrl: string;
    /** accessToken 来自 oauths 表中的 mintcat 记录，只读 */
    accessToken: string;
}

export interface CloudBackupMetadata {
    createdAt: string;
    size: number;
    checksum?: string;
    appVersion?: string;
    schemaVersion?: string;
    deviceId?: string;
    note?: string;
}

export interface CloudBackupRecord extends CloudBackupMetadata {
    id: string;
}

const BASE_URL = "https://api.mintcat.work";

const DB_FILE_NAME = "mintcat.sqlite";
const RESTORE_SUFFIX = ".restore";
const BACKUP_SUFFIX = ".bak";

async function getDatabasePath(): Promise<string> {
    return await path.join(await configDir(), "com.mint.cat", DB_FILE_NAME);
}

async function getRestorePath(): Promise<string> {
    return `${await getDatabasePath()}${RESTORE_SUFFIX}`;
}

async function getBackupPath(): Promise<string> {
    return `${await getDatabasePath()}${BACKUP_SUFFIX}`;
}

function normalizeBaseUrl(url: string): string {
    return url.trim().replace(/\/+$/, "");
}

function buildAuthHeaders(accessToken: string): HeadersInit {
    if (!accessToken) {
        return {};
    }
    return {
        Authorization: `Bearer ${accessToken}`,
    };
}

async function sha256Hex(data: Uint8Array): Promise<string | undefined> {
    if (!globalThis.crypto?.subtle) {
        return undefined;
    }
    const buffer = new ArrayBuffer(data.byteLength);
    new Uint8Array(buffer).set(data);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

async function parseResponseJson<T>(response: Response): Promise<T | undefined> {
    const text = await response.text();
    if (!text) {
        return undefined;
    }
    try {
        return JSON.parse(text) as T;
    } catch {
        return undefined;
    }
}

async function throwIfNotOk(response: Response): Promise<void> {
    if (response.ok) {
        return;
    }
    const data = await parseResponseJson<{ message?: string }>(response);
    const message = data?.message || `Request failed (${response.status})`;
    throw new Error(message);
}

async function fetchBytes(url: string, headers?: HeadersInit): Promise<Uint8Array> {
    const response = await fetch(url, { headers });
    await throwIfNotOk(response);
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
}

export class CloudBackupApi {
    /**
     * 获取云备份配置
     * accessToken 来自 oauths 表中的 mintcat 记录
     */
    public static async getConfig(): Promise<CloudBackupConfig> {
        const oauthDAO = await StorageAPI.getOAuths();
        const mintcatOAuth = await oauthDAO.getActiveUserOAuthByPlatform('mintcat');
        
        return {
            baseUrl: BASE_URL,
            accessToken: mintcatOAuth?.oauth || "",
        };
    }

    public static async listBackups(): Promise<CloudBackupRecord[]> {
        const config = await CloudBackupApi.getConfig();
        const baseUrl = normalizeBaseUrl(config.baseUrl);
        if (!baseUrl) {
            return [];
        }
        // 如果没有设置 token，直接返回空列表，避免请求失败
        if (!config.accessToken) {
            return [];
        }
        const response = await fetch(`${baseUrl}/v1/backups`, {
            headers: {
                ...buildAuthHeaders(config.accessToken),
            },
        });
        await throwIfNotOk(response);
        const data = await parseResponseJson<{ items?: CloudBackupRecord[] } | CloudBackupRecord[]>(response);
        if (Array.isArray(data)) {
            return data;
        }
        return data?.items ?? [];
    }

    public static async createBackup(note?: string): Promise<CloudBackupRecord> {
        const config = await CloudBackupApi.getConfig();
        if (!config.accessToken?.trim()) {
            throw new Error("云备份功能需要 vip 授权，请前往 vip.mintcat.work 获取");
        }
        const baseUrl = normalizeBaseUrl(config.baseUrl);
        if (!baseUrl) {
            throw new Error("Cloud backup endpoint is empty");
        }

        const dbPath = await getDatabasePath();
        if (!await exists(dbPath)) {
            throw new Error("Database file not found");
        }

        const fileBytes = await readFile(dbPath);
        const fileStat = await stat(dbPath);
        const checksum = await sha256Hex(fileBytes);
        const appVersion = await getVersion();

        const cleanedNote = note?.trim();
        const metadata: CloudBackupMetadata = {
            createdAt: new Date().toISOString(),
            size: fileStat.size,
            checksum,
            appVersion,
            note: cleanedNote ? cleanedNote : undefined,
        };

        const formData = new FormData();
        formData.append("metadata", JSON.stringify(metadata));
        formData.append(
            "file",
            new Blob([fileBytes], { type: "application/octet-stream" }),
            DB_FILE_NAME,
        );

        const response = await fetch(`${baseUrl}/v1/backups`, {
            method: "POST",
            headers: {
                ...buildAuthHeaders(config.accessToken),
            },
            body: formData,
        });

        await throwIfNotOk(response);
        const data = await parseResponseJson<{ backup?: CloudBackupRecord; data?: CloudBackupRecord } | CloudBackupRecord>(response);
        if (!data) {
            return { ...metadata, id: "" };
        }
        if ("backup" in data && data.backup) {
            return data.backup;
        }
        if ("data" in data && data.data) {
            return data.data;
        }
        return data as CloudBackupRecord;
    }

    public static async downloadBackupBytes(backupId: string): Promise<Uint8Array> {
        const config = await CloudBackupApi.getConfig();
        const baseUrl = normalizeBaseUrl(config.baseUrl);
        if (!baseUrl) {
            throw new Error("Cloud backup endpoint is empty");
        }
        const response = await fetch(`${baseUrl}/v1/backups/${backupId}/download`, {
            headers: {
                ...buildAuthHeaders(config.accessToken),
                "Accept": "application/octet-stream",
            },
        });
        await throwIfNotOk(response);
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            const data = await parseResponseJson<{ downloadUrl?: string }>(response);
            if (data?.downloadUrl) {
                return await fetchBytes(data.downloadUrl);
            }
            throw new Error("Download URL missing");
        }
        const buffer = await response.arrayBuffer();
        return new Uint8Array(buffer);
    }

    public static async downloadBackupToPath(backupId: string, targetPath: string): Promise<void> {
        const bytes = await CloudBackupApi.downloadBackupBytes(backupId);
        await writeFile(targetPath, bytes);
    }

    public static async prepareRestore(backupId: string): Promise<string> {
        const restorePath = await getRestorePath();
        const bytes = await CloudBackupApi.downloadBackupBytes(backupId);
        await writeFile(restorePath, bytes);
        return restorePath;
    }

    public static async deleteBackup(backupId: string): Promise<void> {
        const config = await CloudBackupApi.getConfig();
        const baseUrl = normalizeBaseUrl(config.baseUrl);
        if (!baseUrl) {
            throw new Error("Cloud backup endpoint is empty");
        }
        const response = await fetch(`${baseUrl}/v1/backups/${backupId}`, {
            method: "DELETE",
            headers: {
                ...buildAuthHeaders(config.accessToken),
            },
        });
        await throwIfNotOk(response);
    }

    public static async applyPendingRestore(): Promise<boolean> {
        const restorePath = await getRestorePath();
        if (!await exists(restorePath)) {
            return false;
        }

        const dbPath = await getDatabasePath();
        const backupPath = await getBackupPath();

        if (await exists(backupPath)) {
            await remove(backupPath);
        }
        if (await exists(dbPath)) {
            await copyFile(dbPath, backupPath);
            await remove(dbPath);
        }

        await copyFile(restorePath, dbPath);
        await remove(restorePath);
        return true;
    }
}
