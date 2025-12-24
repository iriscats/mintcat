import {invoke} from '@tauri-apps/api/core';
import {listenEvent} from "@/events";
import {NetworkApi} from "@/apis/NetworkApi.ts";

export type DownloadProgressCallBack = (downloaded: number, total: number) => void

type DownloadProgress = {
    downloadedSize: number,
    totalSize: number
}

export class DownloadApi {


    public static async downloadLargeFile(url: string, filePath: string, callback?: DownloadProgressCallBack): Promise<string> {
        return new Promise<string>(async (resolve, reject) => {
            const unlisten1 = await listenEvent('download-api-progress', (payload) => {
                console.log(payload);
                if (callback)
                    callback(payload.downloadedSize, payload.totalSize);
            });

            const unlisten2 = await listenEvent('download-api-status', (status) => {
                unlisten1();
                unlisten2();
                console.log(status);
                if (status === "success") {
                    resolve(status);
                } else {
                    reject(status);
                }
            });

            await invoke('download_large_file', {
                url: url,
                filePath: filePath,
            });
        })

    }

    public static async downloadFile(url: string, callback?: DownloadProgressCallBack) {
        const response = await NetworkApi.get(url);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('Failed to get response reader');
        }

        const contentLength = Number(response.headers.get('Content-Length')) || 0;
        let receivedLength = 0;
        const chunks: Uint8Array[] = [];

        while (true) {
            const {done, value} = await reader.read();
            if (done)
                break;

            chunks.push(value);
            receivedLength += value.length;

            if (callback) {
                callback(receivedLength, contentLength);
            }
        }

        // 合并所有 chunk
        const data = new Uint8Array(receivedLength);
        let position = 0;
        for (const chunk of chunks) {
            data.set(chunk, position);
            position += chunk.length;
        }

        return data;
    }

}