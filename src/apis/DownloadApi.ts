import {invoke} from '@tauri-apps/api/core';
import {listenEvent} from "@/events";
import {NetworkApi} from "@/apis/NetworkApi.ts";

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
    resume?: boolean
}

export class DownloadApi {

    /**
     * Download a file using the backend download manager
     * @param url - The URL to download from (will be transformed with proxy if needed)
     * @param filePath - The local file path to save to
     * @param options - Download options (checksum, retry, etc.)
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
        return new Promise<string>(async (resolve, reject) => {
            // Transform URL with proxy if needed
            const transformedUrl = NetworkApi.getUrl(url);

            // Invoke backend download command
            let result: DownloadResult;
            try {
                result = await invoke('download_file', {
                    url: transformedUrl,
                    filePath: filePath,
                    options: options || null,
                });
            } catch (error) {
                reject(error);
                return;
            }

            const downloadId = result.downloadId;

            // Listen for progress events
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

            // Listen for status events
            const unlisten2 = await listenEvent('download-status', (payload: DownloadStatus) => {
                if (payload.downloadId === downloadId) {
                    unlisten1();
                    unlisten2();

                    if (statusCallback) {
                        statusCallback(payload.status, payload.error, payload.filePath);
                    }

                    if (payload.status === 'completed') {
                        resolve(downloadId);
                    } else if (payload.status === 'failed') {
                        reject(new Error(payload.error || 'Download failed'));
                    } else if (payload.status === 'cancelled') {
                        reject(new Error('Download cancelled'));
                    }
                }
            });
        });
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
