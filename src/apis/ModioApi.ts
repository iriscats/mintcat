import {message} from "antd";
import {t} from "i18next";
import {ModInfo} from "../vm/modio/ModInfo.ts";
import {ModListItem} from "../vm/config/ModList.ts";
import {AppViewModel} from "../vm/AppViewModel.ts";
import {UserInfo} from "../vm/modio/UserInfo.ts";
import {EventInfo} from "../vm/modio/EventInfo.ts";
import {CacheApi} from "./CacheApi.ts";

const PROXY_API_URL = "https://api.v1st.net/";
const IS_PROXY = false;

//const MODIO_API_URL = "https://api.mod.io/v1";
//const MODIO_API_URL = "https://u-13595141.modapi.io/v1";
const MODIO_API_URL = "https://u-35860046.modapi.io/v1";
const MODIO_GAME_ID = 2475;


export class ModioApi {

    private static async getHost() {
        if (IS_PROXY) {
            return PROXY_API_URL + MODIO_API_URL;
        } else {
            return MODIO_API_URL;
        }
    }

    private static async getHeaders() {
        const vm = await AppViewModel.getInstance();
        return {
            Authorization: `Bearer ${vm.setting?.modioOAuth}`,
        }
    }

    private static async getRequest(path: string) {
        const host = await ModioApi.getHost();
        const url = host + path;
        const resp = await fetch(url, {
            headers: await ModioApi.getHeaders(),
        });
        switch (resp.status) {
            case 200:
                return await resp.json();
            case 401:
                throw Error(`${t("Modio Unauthorized")}`);
            case 404:
                throw Error(`${t("Modio Not Found")}`);
            case 429:
                throw Error(`${t("Modio Too Many Requests")}`);
            default:
                throw Error(`${t("Modio Error")}: ${resp.status}`);
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
            message.error(`${t("Invalid Mod Link")}: ${url}`);
            return;
        }

        if (result.modId === undefined) {
            return await ModioApi.getModInfoByName(result.nameId);
        } else {
            return await ModioApi.getModInfoById(result.modId);
        }
    }

    public static async getUserInfo() {
        try {
            const path = "/me";
            const data = await ModioApi.getRequest(path);
            return data as UserInfo;
        } catch (e) {
            message.error(`${t("Fetch User Info Error")}: ${e}`);
        }
    }

    public static async ping() {
        try {
            const path = "/ping";
            const data = await ModioApi.getRequest(path);
            if (data.code === 200)
                return true;
        } catch (_) {
        }
        return false;
    }

    public static async getModInfoByName(nameId: string): Promise<ModInfo> {
        try {
            const path = `/games/${MODIO_GAME_ID}/mods?name_id=${nameId}`;
            const data = await ModioApi.getRequest(path);
            return data["data"][0];
        } catch (e) {
            message.error(`${t("Fetch Mod Info Error")}: ${e}`);
        }
    }

    public static async getModInfoById(modId: string): Promise<ModInfo> {
        try {
            const path = `/games/${MODIO_GAME_ID}/mods/${modId}`;
            const data = await ModioApi.getRequest(path);
            return data as ModInfo;
        } catch (e) {
            message.error(`${t("Fetch Mod Info Error")}: ${e}`);
        }
    }

    public static async getModList(pageNo: number = 0, pageSize: number = 20, name: string = undefined): Promise<ModInfo[]> {
        try {
            let path = "";
            if (name) {
                path = `/games/${MODIO_GAME_ID}/mods?name-lk=*${name}*`;
            } else {
                path = `/games/${MODIO_GAME_ID}/mods?_limit=${pageSize}&_offset=${pageSize * pageNo}`;
            }
            const data = await ModioApi.getRequest(path);
            return data.data as ModInfo[];
        } catch (e) {
            message.error(`${t("Fetch Mod Info Error")}: ${e}`);
            return [];
        }
    }

    public static async getDependencies(modId: number) {
        try {
            const path = `/games/${MODIO_GAME_ID}/mods/${modId}/dependencies`;
            const data = await ModioApi.getRequest(path);
            return data.data as ModInfo[];
        } catch (e) {
            message.error(`${t("Fetch Dependence Error")}: ${e}`);
        }
    }

    public static async getEvents(dateAdded: number, modIds: string) {
        try {
            const event_type = ["MODFILE_CHANGED", "MOD_UNAVAILABLE", "MOD_DELETED"];
            const path = `/games/${MODIO_GAME_ID}/mods/events?mod_id-in=${modIds}&date_added-min=${dateAdded}&event_type-in=${event_type.join(",")}`;
            const data = await ModioApi.getRequest(path);
            return data.data as EventInfo[];
        } catch (e) {
            message.error(`${t("Fetch Events Error")}: ${e}`);
        }
    }

    public static async downloadModFile(modInfo: ModListItem,
                                        onProgress?: (loaded: number, total: number) => void) {

        if (await CacheApi.checkCacheFile(modInfo.nameId, modInfo.fileSize)) {
            //modInfo.downloadProgress = 100;
            modInfo.cachePath = await CacheApi.getModCachePath(modInfo.nameId);
            onProgress(modInfo.fileSize, modInfo.fileSize);
            //console.log("Load Cache " + modInfo.cachePath);
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

}
