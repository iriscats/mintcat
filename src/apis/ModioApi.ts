import {ModInfo} from "../vm/modio/ModInfo.ts";
import {ModListItem} from "../vm/config/ModList.ts";
import CacheApi from "./CacheApi.ts";
import {AppViewModel} from "../vm/AppViewModel.ts";
import {message} from "antd";

const PROXY_MODIO_API_URL = "https://api.v1st.net/https://api.mod.io";
const MODIO_API_URL = "https://api.mod.io";
const GAME_ID = 2475;
const IS_PROXY = true;

class ModioApi {

    private constructor() {
    }

    private static async getHost() {
        if (IS_PROXY) {
            return PROXY_MODIO_API_URL;
        } else {
            return MODIO_API_URL;
        }
    }

    private static async getApiKey() {
        const vm = await AppViewModel.getInstance();
        if (vm.setting?.modioOAuth.length > 32) {
            return null;
        } else {
            return vm.setting?.modioOAuth;
        }
    }

    private static async buildRequestUrl(api: string) {
        const host = await ModioApi.getHost();
        const key = await ModioApi.getApiKey();
        if (key) {
            return `${host}/v1/games/${GAME_ID}/${api}?api_key=${key}`;
        } else {
            return `${host}/v1/games/${GAME_ID}/${api}`;
        }
    }


    private static async getHeaders() {
        const vm = await AppViewModel.getInstance();
        return {
            Authorization: `Bearer ${vm.setting?.modioOAuth}`,
        }
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
            message.error("Invalid mod link:" + url);
            return;
        }

        if (result.modId === undefined) {
            return await ModioApi.getModInfoByName(result.nameId);
        } else {
            return await ModioApi.getModInfoById(result.modId);
        }
    }


    public static async getModInfoByName(nameId: string): Promise<ModInfo> {
        const key = await ModioApi.getApiKey();
        const host = await ModioApi.getHost();
        const modRequestUrl = `${host}/v1/games/${GAME_ID}/mods?name_id=${nameId}`;

        try {
            const resp = await fetch(modRequestUrl, {
                headers: await ModioApi.getHeaders(),
            });
            const data = await resp.json();
            console.log(data);
            return data["data"][0];
        } catch (e) {
            console.error(e);
            message.error("Fetch Mod Error" + e);
        }
    }

    public static async getModInfoById(modId: string): Promise<ModInfo> {
        const key = await ModioApi.getApiKey();
        const host = await ModioApi.getHost();
        const modRequestUrl = `${host}/v1/games/${GAME_ID}/mods/${modId}`;

        try {
            const resp = await fetch(modRequestUrl, {
                headers: await ModioApi.getHeaders(),
            });
            return await resp.json();
        } catch (e) {
            console.error(e);
            message.error("Fetch Mod Error" + e);
        }
    }

    public static async getModList(name: string = undefined): Promise<ModInfo[]> {
        try {
            let url = await this.buildRequestUrl("mods");
            if (name) {
                url = `${url}?name-lk=*${name}*`;
            }
            const resp = await fetch(url, {
                headers: await ModioApi.getHeaders(),
            });
            const data = await resp.json();
            return data.data as ModInfo[];
        } catch (e) {
            message.error("Fetch Mod List Error");
            return [];
        }
    }

    public static async downloadModFile(modInfo: ModListItem,
                                        onProgress?: (loaded: number, total: number) => void) {

        if (await CacheApi.checkCacheFile(modInfo.nameId, modInfo.fileSize)) {
            modInfo.downloadProgress = 100;
            modInfo.cachePath = await CacheApi.getModCachePath(modInfo.nameId);
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

    public static async getModEvents() {
        `/games/${GAME_ID}/mods/events`
    }

    public static async getUserInfo() {
        //https://*.modapi.io/v1/me
    }


}

export default ModioApi;

