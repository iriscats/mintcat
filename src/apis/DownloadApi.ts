import {invoke} from '@tauri-apps/api/core';
import {listen} from "@tauri-apps/api/event";

export type DownloadProgressCallBack = (downloaded: number, total: number) => void

type DownloadProgress = {
    downloadedSize: number,
    totalSize: number
}

export class DownloadApi {


    public static async downloadLargeFile(url: string, filePath: string, callback?: DownloadProgressCallBack): Promise<string> {
        return new Promise<string>(async (resolve, reject) => {
            const unlisten1 = await listen<DownloadProgress>('download-api-progress', (event) => {
                console.log(event.payload);
                if (callback)
                    callback(event.payload.downloadedSize, event.payload.totalSize);
            });

            const unlisten2 = await listen<string>('download-api-statue', (event) => {
                unlisten1();
                unlisten2();
                console.log(event.payload);
                if (event.payload === "success") {
                    resolve(event.payload);
                } else {
                    reject(event.payload);
                }
            });

            await invoke('download_large_file', {
                url: url,
                filePath: filePath,
            });
        })

    }

    public static async downloadFile(url: string, callback?: DownloadProgressCallBack) {

        const response = await fetch(url);
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