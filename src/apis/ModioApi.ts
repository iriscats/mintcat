import {message} from "antd";
import {t} from "i18next";
import {ModInfo} from "../vm/modio/ModInfo.ts";
import {ModListItem} from "../vm/config/ModList.ts";
import {AppViewModel} from "../vm/AppViewModel.ts";
import {UserInfo} from "../vm/modio/UserInfo.ts";
import {EventInfo} from "../vm/modio/EventInfo.ts";
import {CacheApi} from "./CacheApi.ts";

const PROXY_API_URL = "https://api.v1st.net/";
const MODIO_API_URL = "https://api.mod.io";
const MODIO_GAME_ID = 2475;
const IS_PROXY = true;

export class ModioApi {

    private static async getHost() {
        if (IS_PROXY) {
            return PROXY_API_URL + MODIO_API_URL;
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
        return await resp.json();
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
            message.error(t("Invalid Mod Link") + url);
            return;
        }

        if (result.modId === undefined) {
            return await ModioApi.getModInfoByName(result.nameId);
        } else {
            return await ModioApi.getModInfoById(result.modId);
        }
    }


    public static async getModInfoByName(nameId: string): Promise<ModInfo> {
        try {
            const path = `/v1/games/${MODIO_GAME_ID}/mods?name_id=${nameId}`;
            const data = await ModioApi.getRequest(path);
            return data["data"][0];
        } catch (e) {
            message.error(t("Fetch Mod Info Error") + e);
        }
    }

    public static async getModInfoById(modId: string): Promise<ModInfo> {
        try {
            const path = `/v1/games/${MODIO_GAME_ID}/mods/${modId}`;
            const data = await ModioApi.getRequest(path);
            return data as ModInfo;
        } catch (e) {
            message.error(t("Fetch Mod Info Error") + e);
        }
    }

    public static async getModList(pageNo: number = 0, pageSize: number = 20, name: string = undefined): Promise<ModInfo[]> {
        try {
            let path = "";
            if (name) {
                path = `/v1/games/${MODIO_GAME_ID}/mods?name-lk=*${name}*`;
            } else {
                path = `/v1/games/${MODIO_GAME_ID}/mods?_limit=${pageSize}&_offset=${pageSize * pageNo}`;
            }
            const data = await ModioApi.getRequest(path);
            return data.data as ModInfo[];
        } catch (e) {
            message.error(t("Fetch Mod Info Error"));
            return [];
        }
    }

    public static async getUserInfo() {
        try {
            const path = "/v1/me";
            const data = await ModioApi.getRequest(path);
            return data as UserInfo;
        } catch (e) {
            message.error(t("Fetch UserInfo Error") + e);
        }
    }

    public static async getDependencies(modId: number) {
        try {
            const path = `/v1/games/${MODIO_GAME_ID}/mods/${modId}/dependencies`;
            const data = await ModioApi.getRequest(path);
            return data.data as ModInfo[];
        } catch (e) {
            message.error(t("Fetch Dependence Error") + e);
        }
    }

    public static async getEvents(dateAdded: number, modIds: string) {
        try {
            const path = `/v1/games/${MODIO_GAME_ID}/mods/events?mod_id-in=${modIds}&date_added-min=${dateAdded}&event_type-in=MODFILE_CHANGED,MOD_UNAVAILABLE,MOD_DELETED`;
            const data = await ModioApi.getRequest(path);
            return data.data as EventInfo[];
        } catch (e) {
            message.error(t("Fetch Events Error") + e);
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

}
