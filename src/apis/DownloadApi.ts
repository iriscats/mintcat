import {invoke} from '@tauri-apps/api/core';
import {listenEvent} from "@/events";
import {NetworkApi} from "@/apis/NetworkApi.ts";

/** 直连失败时用此代理重试一次（与 NetworkApi 保持一致） */
const PROXY_API_URL = "https://proxy.mintcat.work/";

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

    /** 单次下载：用给定 URL 调后端，根据 download-status 完成或拒绝 */
    private static async downloadFileOnce(
        urlToTry: string,
        filePath: string,
        options: DownloadOptions | null,
        progressCallback?: DownloadProgressCallBack,
        statusCallback?: DownloadStatusCallBack
    ): Promise<string> {
        const result = await invoke<DownloadResult>('download_file', {
            url: urlToTry,
            filePath,
            options,
        });
        const downloadId = result.downloadId;
        const unlisten1 = await listenEvent('download-progress', (payload: DownloadProgress) => {
            if (payload.downloadId === downloadId && progressCallback) {
                progressCallback(
                    payload.downloadedBytes,
                    payload.totalBytes,
                    payload.speedBytesPerSec,
                    payload.etaSecs
                );
            }
        });
        return new Promise<string>((resolve, reject) => {
            let unlisten2: (() => void) | null = null;
            listenEvent('download-status', (payload: DownloadStatus) => {
                if (payload.downloadId !== downloadId) return;
                unlisten1();
                if (unlisten2) unlisten2();
                if (statusCallback) statusCallback(payload.status, payload.error, payload.filePath);
                if (payload.status === 'completed') resolve(downloadId);
                else if (payload.status === 'failed') reject(new Error(payload.error || 'Download failed'));
                else if (payload.status === 'cancelled') reject(new Error('Download cancelled'));
            }).then((fn) => { unlisten2 = fn; });
        });
    }

    /**
     * Download a file using the backend download manager.
     * 直连失败时会用 proxy.mintcat.work 重试一次。
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
        try {
            return await DownloadApi.downloadFileOnce(
                transformedUrl,
                filePath,
                opts,
                progressCallback,
                statusCallback
            );
        } catch (firstErr) {
            if (transformedUrl.startsWith(PROXY_API_URL)) throw firstErr;
            try {
                return await DownloadApi.downloadFileOnce(
                    PROXY_API_URL + url,
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
