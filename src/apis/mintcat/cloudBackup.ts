import { readFile, writeFile, exists, stat, remove, copyFile } from "@tauri-apps/plugin-fs";
import { path } from "@tauri-apps/api";
import { configDir } from "@tauri-apps/api/path";
import { getVersion } from "@tauri-apps/api/app";
import { NetworkApi } from "@/apis/NetworkApi";
import { AuthResolver, type NetworkProxyPolicy } from "@/services/network";
import i18n from "@/locales/i18n";
import type { CloudBackupConfig, CloudBackupMetadata, CloudBackupRecord } from "./types";
import { getMintcatApiOrigin, MintCatApiUrls, normalizeMintcatApiOrigin } from "./urls";

const DB_FILE_NAME = "mintcat.sqlite";
const RESTORE_SUFFIX = ".restore";
const BACKUP_SUFFIX = ".bak";
const authResolver = new AuthResolver();

async function getDatabasePath(): Promise<string> {
    return await path.join(await configDir(), "com.mint.cat", DB_FILE_NAME);
}

async function getRestorePath(): Promise<string> {
    return `${await getDatabasePath()}${RESTORE_SUFFIX}`;
}

async function getBackupPath(): Promise<string> {
    return `${await getDatabasePath()}${BACKUP_SUFFIX}`;
}

function buildAuthHeaders(accessToken: string): Record<string, string> {
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
    const msg = data?.message || i18n.t("cloudBackup.error.request_failed", { status: response.status });
    throw new Error(msg);
}

async function requestResponse(
    url: string,
    options: {
        service: string;
        method?: string;
        headers?: Record<string, string>;
        body?: BodyInit | null;
        proxyPolicy?: NetworkProxyPolicy;
    },
): Promise<Response> {
    const result = await NetworkApi.request<Response>({
        service: options.service,
        url,
        method: options.method,
        headers: options.headers,
        body: options.body,
        proxyPolicy: options.proxyPolicy ?? 'direct',
        parseAs: 'response',
    });
    return result.response;
}

async function fetchBytes(
    url: string,
    headers?: Record<string, string>,
    proxyPolicy: NetworkProxyPolicy = 'direct',
): Promise<Uint8Array> {
    const response = await requestResponse(url, {
        service: 'mintcat.cloudBackup.fetchBytes',
        headers,
        proxyPolicy,
    });
    await throwIfNotOk(response);
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
}

/**
 * 云备份 API，accessToken 来自 oauths 表中的 mintcat 记录。
 */
export class CloudBackupApi {
    public static async getConfig(): Promise<CloudBackupConfig> {
        return {
            baseUrl: getMintcatApiOrigin(),
            accessToken: await authResolver.getMintcatToken(),
        };
    }

    public static async listBackups(): Promise<CloudBackupRecord[]> {
        const config = await CloudBackupApi.getConfig();
        const baseUrl = normalizeMintcatApiOrigin(config.baseUrl);
        if (!baseUrl) {
            return [];
        }
        if (!config.accessToken) {
            return [];
        }
        const response = await requestResponse(MintCatApiUrls.cloudBackup.list(baseUrl), {
            service: 'mintcat.cloudBackup.listBackups',
            headers: {
                ...buildAuthHeaders(config.accessToken),
            },
            proxyPolicy: 'direct',
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
            throw new Error(i18n.t("cloudBackup.error.auth_required"));
        }
        const baseUrl = normalizeMintcatApiOrigin(config.baseUrl);
        if (!baseUrl) {
            throw new Error(i18n.t("cloudBackup.error.endpoint_empty"));
        }

        const dbPath = await getDatabasePath();
        if (!(await exists(dbPath))) {
            throw new Error(i18n.t("cloudBackup.error.database_not_found"));
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

        const response = await requestResponse(MintCatApiUrls.cloudBackup.list(baseUrl), {
            service: 'mintcat.cloudBackup.createBackup',
            method: "POST",
            headers: {
                ...buildAuthHeaders(config.accessToken),
            },
            body: formData,
            proxyPolicy: 'direct',
        });

        await throwIfNotOk(response);
        const data = await parseResponseJson<
            { backup?: CloudBackupRecord; data?: CloudBackupRecord } | CloudBackupRecord
        >(response);
        if (!data) {
            throw new Error(i18n.t("cloudBackup.error.request_failed", { status: response.status }));
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
        const baseUrl = normalizeMintcatApiOrigin(config.baseUrl);
        if (!baseUrl) {
            throw new Error(i18n.t("cloudBackup.error.endpoint_empty"));
        }
        const response = await requestResponse(MintCatApiUrls.cloudBackup.download(backupId, baseUrl), {
            service: 'mintcat.cloudBackup.downloadBackup',
            headers: {
                ...buildAuthHeaders(config.accessToken),
                Accept: "application/octet-stream",
            },
            proxyPolicy: 'direct',
        });
        await throwIfNotOk(response);
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
            const data = await parseResponseJson<{ downloadUrl?: string }>(response);
            if (data?.downloadUrl) {
                return await fetchBytes(data.downloadUrl);
            }
            throw new Error(i18n.t("cloudBackup.error.download_url_missing"));
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
        const baseUrl = normalizeMintcatApiOrigin(config.baseUrl);
        if (!baseUrl) {
            throw new Error(i18n.t("cloudBackup.error.endpoint_empty"));
        }
        const response = await requestResponse(MintCatApiUrls.cloudBackup.byId(backupId, baseUrl), {
            service: 'mintcat.cloudBackup.deleteBackup',
            method: "DELETE",
            headers: {
                ...buildAuthHeaders(config.accessToken),
            },
            proxyPolicy: 'direct',
        });
        await throwIfNotOk(response);
    }

    /**
     * 判断是否为「文件被占用」类错误（Windows ERROR_SHARING_VIOLATION 32、EBUSY、EACCES 等）
     */
    private static isFileInUseError(e: unknown): boolean {
        const msg = e instanceof Error ? e.message : String(e);
        return (
            /os error 32/i.test(msg) ||
            /另一个程序正在使用|文件正在使用|the process cannot access/i.test(msg) ||
            /EBUSY|EACCES|EPERM|ETXTBSY/i.test(msg) ||
            /being used by another process|sharing violation/i.test(msg)
        );
    }

    /**
     * 带重试的删除：恢复时若数据库被占用（如上一进程未完全退出），重试几次并间隔等待。
     */
    private static async removeWithRetry(
        filePath: string,
        maxAttempts = 4,
        delayMs = 1500,
    ): Promise<void> {
        let lastError: unknown;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                await remove(filePath);
                return;
            } catch (e) {
                lastError = e;
                if (attempt < maxAttempts && CloudBackupApi.isFileInUseError(e)) {
                    await new Promise((r) => setTimeout(r, delayMs));
                    continue;
                }
                if (CloudBackupApi.isFileInUseError(e)) {
                    const raw = e instanceof Error ? e.message : String(e);
                    throw new Error(i18n.t("cloudBackup.error.file_in_use_retry", { detail: raw }));
                }
                throw e;
            }
        }
        throw lastError;
    }

    public static async applyPendingRestore(): Promise<boolean> {
        const restorePath = await getRestorePath();
        if (!(await exists(restorePath))) {
            return false;
        }

        const dbPath = await getDatabasePath();
        const backupPath = await getBackupPath();

        if (await exists(backupPath)) {
            await remove(backupPath);
        }
        if (await exists(dbPath)) {
            await copyFile(dbPath, backupPath);
            await CloudBackupApi.removeWithRetry(dbPath);
        }

        await copyFile(restorePath, dbPath);
        await remove(restorePath);
        return true;
    }
}
