import {invoke} from '@tauri-apps/api/core';
import {listenEvent} from "@/events";
import {NetworkApi} from "@/apis/NetworkApi.ts";
import {isMintcatProxyUrl, mintcatProxyUrl} from "@/apis/mintcat/urls";

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

export type DownloadOptions = {
    checksum?: string,
    checksumType?: 'md5' | 'sha256',
    timeoutSecs?: number,
    retryCount?: number,
    resume?: boolean,
    headers?: Record<string, string>
}

export class DownloadApi {

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
        const transformedUrl = NetworkApi.getUrl(url);
        const fallbackProxyUrl = mintcatProxyUrl(url);
        try {
            return await DownloadApi.downloadFileOnce(
                transformedUrl,
                filePath,
                opts,
                progressCallback,
                statusCallback
            );
        } catch (firstErr) {
            if (isMintcatProxyUrl(transformedUrl)) throw firstErr;
            try {
                return await DownloadApi.downloadFileOnce(
                    fallbackProxyUrl,
                    filePath,
                    opts,
                    progressCallback,
                    statusCallback
                );
            } catch (_) {
                throw firstErr;
            }
        }
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
}
