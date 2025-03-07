import {ModInfo} from "../vm/modio/ModInfo.ts";
import {ModListItem} from "../vm/config/ModList.ts";
import CacheApi from "./CacheApi.ts";

const PROXY_MODIO_API_URL = "https://api.v1st.net/https://api.mod.io/";
const MODIO_API_URL = "https://api.mod.io/";
const MODIO_API_KEY = "";
const GAME_ID = 2475;

class ModioApi {

    private static buildRequestHeader() {
    }

    private static parseModLinks(link: string) {
        let regex = new RegExp('^https://mod\.io/g/drg/m/([^/#]+)(?:#(\\d+)(?:/(\\d+))?)?$');
        let match = link.match(regex);
        if (match !== null) {
            let nameId = match[1];
            let modId = match[2];
            let modifyId = match[3];

            console.log(`name_id: ${nameId}, mod_id: ${modId}, modify_id: ${modifyId}`);
            return {nameId, modId, modifyId};
        }
    }

    public static async getModInfoByLink(url: string): Promise<ModInfo> {
        const result = ModioApi.parseModLinks(url);
        if (result === undefined) {
            return Promise.reject("Invalid mod link");
        }

        const modRequestUrl = `${PROXY_MODIO_API_URL}v1/games/${GAME_ID}/mods/${result.modId}?api_key=${MODIO_API_KEY}`;
        const resp = await fetch(modRequestUrl);
        if (resp.status === 200) {
            const data = await resp.json();
            console.log(data);
            return data;
        } else {
            return Promise.reject("Mod not found");
        }
    }

    private static buildRequestUrl(): string {
        return `${PROXY_MODIO_API_URL}v1/games/${GAME_ID}/mods?api_key=${MODIO_API_KEY}`;
    }

    public static async getModInfoByName(nameId: string): Promise<Response> {
        const resp = await fetch(this.buildRequestUrl() + "&name_id=" + nameId);
        return resp.json();
    }

    public static async getModList(): Promise<Response> {
        const resp = await fetch(this.buildRequestUrl());
        return resp.json();
    }

    public static async downloadModFile(modInfo: ModListItem,
                                        onProgress?: (loaded: number, total: number) => void) {

        if (await CacheApi.checkCacheFile(modInfo.nameId, modInfo.fileSize)) {
            modInfo.downloadProgress = 100;
            modInfo.cachePath = CacheApi.getModCachePath(modInfo.nameId);
            onProgress(1, 1);
            console.log("Load Cache " + modInfo.cachePath);
            return modInfo;
        }

        const response = await fetch(modInfo.downloadUrl);
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

            // 触发进度回调
            if (onProgress) {
                onProgress(receivedLength, contentLength);
            }
        }

        // 合并所有 chunk
        const data = new Uint8Array(receivedLength);
        let position = 0;
        for (const chunk of chunks) {
            data.set(chunk, position);
            position += chunk.length;
        }

        modInfo.cachePath = await CacheApi.saveCacheFile(modInfo.nameId, data);
        modInfo.downloadProgress = 100;
        return modInfo;
    }

    public static async getModioApi() {
        `/games/${GAME_ID}/mods/events`
    }

}

export default ModioApi;

