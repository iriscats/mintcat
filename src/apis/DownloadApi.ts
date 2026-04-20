import {invoke} from '@tauri-apps/api/core';
import {listenEvent} from "@/events";
import {NetworkApi} from "@/apis/NetworkApi.ts";
import { IoC } from "@/core/IoC";
import { RequestLogger, type NetworkResolvedRoute } from "@/services/network";

export type DownloadProgressCallBack = (downloaded: number, total: number, speed: number, eta: number) => void
export type DownloadStatusCallBack = (status: string, error?: string, filePath?: string) => void

type DownloadProgress = {
    downloadId: string,
    downloadedBytes: number,
    totalBytes: number,
    speedBytesPerSec: number,
    etaSecs: number
}

type DownloadStatus = {
    downloadId: string,
    status: string,
    error?: string,
    filePath?: string
}

type DownloadResult = {
    downloadId: string,
    filePath: string
}

type P2pProgress = {
    downloadId: string,
    downloadedBytes: number,
    totalBytes: number,
    speedBytesPerSec: number,
    etaSecs: number,
    peers: number,
    uploadBytesPerSec: number,
}

type P2pStatus = DownloadStatus

type P2pDownloadResult = DownloadResult

export type P2pDownloadOptions = {
    /** MD5 终校验（十六进制），与 HTTP 下载语义相同 */
    checksum?: string,
    /** 首 piece 超时秒数，默认 20；超时未拿到任何数据即视为失败，调用方应回退 HTTP */
    firstPieceTimeoutSecs?: number,
}

export type DownloadOptions = {
    checksum?: string,
    checksumType?: 'md5' | 'sha256',
    timeoutSecs?: number,
    retryCount?: number,
    resume?: boolean,
    headers?: Record<string, string>
}

export class DownloadApi {
    private static fallbackLogger = new RequestLogger();

    private static buildRequestId(): string {
        return `download-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    }

    private static async getLogger(): Promise<RequestLogger> {
        try {
            return await IoC.get(RequestLogger);
        } catch {
            return this.fallbackLogger;
        }
    }

    /**
     * Single download attempt: register event listeners BEFORE invoking the
     * backend so that fast completions / failures are never missed.
     */
    private static async downloadFileOnce(
        urlToTry: string,
        filePath: string,
        options: DownloadOptions | null,
        progressCallback?: DownloadProgressCallBack,
        statusCallback?: DownloadStatusCallBack
    ): Promise<string> {
        let downloadId: string | null = null;
        let settled = false;
        let unlistenProgress: (() => void) | null = null;
        let unlistenStatus: (() => void) | null = null;

        const cleanup = () => {
            if (unlistenProgress) { unlistenProgress(); unlistenProgress = null; }
            if (unlistenStatus) { unlistenStatus(); unlistenStatus = null; }
        };

        return new Promise<string>(async (resolve, reject) => {
            const settle = (fn: () => void) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                cleanup();
                fn();
            };

            const timeoutMs = ((options?.timeoutSecs) || 900) * 1000 + 30_000;
            const timer = setTimeout(() => {
                settle(() => reject(new Error('Download timed out (no status event received)')));
            }, timeoutMs);

            // Step 1: Register BOTH listeners before starting the download
            [unlistenProgress, unlistenStatus] = await Promise.all([
                listenEvent('download-progress', (payload: DownloadProgress) => {
                    if (payload.downloadId === downloadId && progressCallback) {
                        progressCallback(
                            payload.downloadedBytes,
                            payload.totalBytes,
                            payload.speedBytesPerSec,
                            payload.etaSecs
                        );
                    }
                }),
                listenEvent('download-status', (payload: DownloadStatus) => {
                    if (payload.downloadId !== downloadId) return;
                    if (statusCallback) statusCallback(payload.status, payload.error, payload.filePath);
                    if (payload.status === 'completed') {
                        settle(() => resolve(downloadId!));
                    } else if (payload.status === 'failed') {
                        settle(() => reject(new Error(payload.error || 'Download failed')));
                    } else if (payload.status === 'cancelled') {
                        settle(() => reject(new Error('Download cancelled')));
                    }
                }),
            ]);

            // Step 2: NOW invoke the backend — listeners are already active
            try {
                const result = await invoke<DownloadResult>('download_file', {
                    url: urlToTry,
                    filePath,
                    options,
                });
                downloadId = result.downloadId;
            } catch (invokeErr) {
                settle(() => reject(invokeErr instanceof Error ? invokeErr : new Error(String(invokeErr))));
            }
        });
    }

    /**
     * Download a file using the backend download manager.
     * 直连失败时会用当前线路对应的代理地址重试一次。
     * @param url - The URL to download from (will be transformed with proxy if needed)
     * @param filePath - The local file path to save to
     * @param options - Download options (checksum, retry, timeout, etc.)
     * @param progressCallback - Called with progress updates
     * @param statusCallback - Called when download completes/fails
     * @returns Promise that resolves with the download ID
     */
    public static async downloadFile(
        url: string,
        filePath: string,
        options?: DownloadOptions,
        progressCallback?: DownloadProgressCallBack,
        statusCallback?: DownloadStatusCallBack
    ): Promise<string> {
        const opts = options || null;
        const logger = await DownloadApi.getLogger();
        const requestId = DownloadApi.buildRequestId();
        const plan = await NetworkApi.resolveRoutePlan(url, 'mintcatProxyFallback');
        const routes = [plan.primary, plan.fallback].filter(Boolean) as NetworkResolvedRoute[];
        let firstErr: unknown;

        for (let i = 0; i < routes.length; i++) {
            const route = routes[i];
            const startedAt = Date.now();
            logger.logAttemptStart({
                requestId,
                service: 'download.file',
                method: 'DOWNLOAD',
                attempt: i + 1,
                route,
                headers: opts?.headers,
            });
            try {
                const result = await DownloadApi.downloadFileOnce(
                    route.resolvedUrl,
                    filePath,
                    opts,
                    progressCallback,
                    statusCallback
                );
                logger.logAttemptSuccess({
                    requestId,
                    service: 'download.file',
                    method: 'DOWNLOAD',
                    attempt: i + 1,
                    route,
                    durationMs: Date.now() - startedAt,
                    status: 200,
                    headers: opts?.headers,
                });
                return result;
            } catch (error) {
                if (firstErr === undefined) {
                    firstErr = error;
                }
                logger.logAttemptFailure({
                    requestId,
                    service: 'download.file',
                    method: 'DOWNLOAD',
                    attempt: i + 1,
                    route,
                    durationMs: Date.now() - startedAt,
                    error,
                    final: i >= routes.length - 1,
                    headers: opts?.headers,
                });
                if (i >= routes.length - 1) {
                    throw firstErr;
                }
            }
        }

        throw firstErr instanceof Error ? firstErr : new Error('Download failed');
    }

    /**
     * Cancel an active download
     * @param downloadId - The download ID to cancel
     */
    public static async cancelDownload(downloadId: string): Promise<void> {
        await invoke('cancel_download', { downloadId });
    }

    /**
     * Legacy method for backward compatibility
     * @deprecated Use downloadFile instead
     */
    public static async downloadLargeFile(
        url: string,
        filePath: string,
        callback?: DownloadProgressCallBack
    ): Promise<string> {
        return this.downloadFile(url, filePath, undefined, callback);
    }

    /**
     * 通过 BitTorrent (librqbit) 下载文件。
     *
     * 接口语义与 {@link downloadFile} 保持一致：
     *   - 进度回调字段：downloaded / total / speed / eta（与 HTTP 下载相同）
     *   - 成功返回 downloadId；失败 reject
     *   - MD5 终校验由后端完成（失败时文件会被删除并 reject）
     *
     * 与 HTTP 下载的差异：
     *   - 不经过 NetworkApi 的代理链；librqbit 会自己处理 DHT/uTP/UPnP 及 Web Seed
     *   - 若首个 piece 在 `firstPieceTimeoutSecs`（默认 20s）内未到达，后端会主动失败，
     *     调用方应当捕获 error 并用 {@link downloadFile} 进行 HTTP 回退
     *
     * @param source magnet:?... 或 https://.../foo.torrent
     * @param filePath 目标路径（后端会把文件重命名至此）
     * @param options P2P 可选项（checksum / 首 piece 超时）
     * @param progressCallback 进度回调
     * @param statusCallback 状态回调（starting / completed / failed）
     */
    public static async downloadViaP2P(
        source: string,
        filePath: string,
        options?: P2pDownloadOptions,
        progressCallback?: DownloadProgressCallBack,
        statusCallback?: DownloadStatusCallBack,
    ): Promise<string> {
        let downloadId: string | null = null;
        let settled = false;
        let unlistenProgress: (() => void) | null = null;
        let unlistenStatus: (() => void) | null = null;

        const cleanup = () => {
            if (unlistenProgress) { unlistenProgress(); unlistenProgress = null; }
            if (unlistenStatus) { unlistenStatus(); unlistenStatus = null; }
        };

        return new Promise<string>(async (resolve, reject) => {
            const settle = (fn: () => void) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                cleanup();
                fn();
            };

            // 全局硬超时：首 piece 超时 + 下载预算（与 HTTP 默认 15min 对齐）
            const firstPieceMs = (options?.firstPieceTimeoutSecs ?? 20) * 1000;
            const timeoutMs = firstPieceMs + 15 * 60 * 1000;
            const timer = setTimeout(() => {
                settle(() => reject(new Error('P2P download timed out')));
            }, timeoutMs);

            [unlistenProgress, unlistenStatus] = await Promise.all([
                listenEvent('p2p-progress', (payload: P2pProgress) => {
                    if (payload.downloadId === downloadId && progressCallback) {
                        progressCallback(
                            payload.downloadedBytes,
                            payload.totalBytes,
                            payload.speedBytesPerSec,
                            payload.etaSecs,
                        );
                    }
                }),
                listenEvent('p2p-status', (payload: P2pStatus) => {
                    if (payload.downloadId !== downloadId) return;
                    if (statusCallback) statusCallback(payload.status, payload.error, payload.filePath);
                    if (payload.status === 'completed') {
                        settle(() => resolve(downloadId!));
                    } else if (payload.status === 'failed') {
                        settle(() => reject(new Error(payload.error || 'P2P download failed')));
                    }
                }),
            ]);

            try {
                const result = await invoke<P2pDownloadResult>('p2p_download', {
                    args: {
                        source,
                        filePath,
                        expectedMd5: options?.checksum,
                        firstPieceTimeoutSecs: options?.firstPieceTimeoutSecs,
                    },
                });
                downloadId = result.downloadId;
            } catch (invokeErr) {
                settle(() => reject(invokeErr instanceof Error ? invokeErr : new Error(String(invokeErr))));
            }
        });
    }

    /** 启停 P2P 功能（关闭后 Session 被 stop，不再占用端口/DHT）。 */
    public static async setP2PEnabled(enabled: boolean): Promise<void> {
        await invoke('p2p_set_enabled', { enabled });
    }

    /** 切换是否在下载完成后继续做种。 */
    public static async setP2PSeeding(seed: boolean): Promise<void> {
        await invoke('p2p_set_seeding', { seed });
    }

    /** 设置上传限速（字节/秒）；0 / null / undefined = 不限速。 */
    public static async setP2PUploadLimit(bytesPerSec: number | null | undefined): Promise<void> {
        await invoke('p2p_set_upload_limit', {
            bytesPerSec: bytesPerSec && bytesPerSec > 0 ? Math.floor(bytesPerSec) : null,
        });
    }

    /** 查询 P2P 统计（用于设置页显示）。 */
    public static async getP2PStats(): Promise<{
        enabled: boolean;
        seeding: boolean;
        uploadLimitBytesPerSec: number | null;
        activeDownloads: number;
        seedingTorrents: number;
    }> {
        return await invoke('p2p_stats');
    }
}
