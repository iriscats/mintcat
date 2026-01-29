import { readFile, writeFile, exists, stat, remove, copyFile } from "@tauri-apps/plugin-fs";
import { path } from "@tauri-apps/api";
import { configDir } from "@tauri-apps/api/path";
import { getVersion } from "@tauri-apps/api/app";
import { StorageAPI } from "@/storage";

export interface CloudBackupConfig {
    baseUrl: string;
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

const SETTINGS_KEYS = {
    baseUrl: "cloudBackupBaseUrl",
    accessToken: "cloudBackupAccessToken",
};

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
    const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
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
    public static async getConfig(): Promise<CloudBackupConfig> {
        const settings = await StorageAPI.getSettings();
        return {
            baseUrl: await settings.getValue(SETTINGS_KEYS.baseUrl),
            accessToken: await settings.getValue(SETTINGS_KEYS.accessToken),
        };
    }

    public static async saveConfig(config: CloudBackupConfig): Promise<void> {
        const settings = await StorageAPI.getSettings();
        await settings.setValue(SETTINGS_KEYS.baseUrl, config.baseUrl ?? "");
        await settings.setValue(SETTINGS_KEYS.accessToken, config.accessToken ?? "");
    }

    public static async listBackups(): Promise<CloudBackupRecord[]> {
        const config = await CloudBackupApi.getConfig();
        const baseUrl = normalizeBaseUrl(config.baseUrl);
        if (!baseUrl) {
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
            return metadata;
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
