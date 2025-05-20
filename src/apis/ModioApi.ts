import {message} from "antd";
import {t} from "i18next";
import {ModFile, ModInfo} from "../vm/modio/ModInfo.ts";
import {ModListItem} from "../vm/config/ModList.ts";
import {AppViewModel} from "../vm/AppViewModel.ts";
import {UserInfo} from "../vm/modio/UserInfo.ts";
import {EventInfo} from "../vm/modio/EventInfo.ts";
import {CacheApi} from "./CacheApi.ts";
import {DownloadApi} from "./DownloadApi.ts";
import {TimeUtils} from "../utils/TimeUtils.ts";
import {retry} from "ts-retry";
import {NetworkApi} from "@/apis/NetworkApi.ts";

//const MODIO_API_URL = "https://api.mod.io/v1";
const MODIO_GAME_ID = 2475;
const MODIO_UID = "13595141";

export class ModioApi {

    static IS_PROXY = false;

    private static async getHost() {
        const vm = await AppViewModel.getInstance();
        const modioUid = vm.setting?.modioUid ?? MODIO_UID;
        return `https://u-${modioUid}.modapi.io/v1`;
    }

    private static async getHeaders() {
        const vm = await AppViewModel.getInstance();
        return {
            Authorization: `Bearer ${vm.setting?.modioOAuth}`,
        }
    }

    private static async getRequest(path: string) {
        let host = await ModioApi.getHost();
        let url = host + path;

        let resp: Response = await NetworkApi.get(url, await ModioApi.getHeaders());

        switch (resp.status) {
            case 200:
                return await resp.json();
            case 401:
                throw Error(`${t("mod.io Unauthorized")}`);
            case 404:
                throw Error(`${t("mod.io Not Found")}`);
            case 422:
                throw Error(`${t("mod.io Request Parameter Error")}: ${url}`);
            case 429:
                throw Error(`${t("mod.io Too Many Requests")}`);
            default:
                throw Error(`${t("mod.io Error")}: ${resp.status}`);
        }
    }

    public static parseModLinks(link: string) {
        let regex = new RegExp('^https://mod\.io/g/drg/m/([^/#]+)');
        let match = link.match(regex);
        if (match !== null) {
            return match[1];
        }
    }

    public static async getModInfoByLink(url: string): Promise<ModInfo> {
        const nameId = ModioApi.parseModLinks(url);
        if (nameId === undefined) {
            message.error(`${t("Invalid Mod Link")}: ${url}`);
            return;
        }
        const modData = await ModioApi.getModInfoByName(nameId);
        if (modData === undefined) {
            message.error(`${t("Mod Not Existed")}: ${url}`);
            return;
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
            let path: string;
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
            // 如果时间小 10 分钟，不请求
            if (TimeUtils.getCurrentTime() - dateAdded < 10 * 60) {
                return [];
            }

            const event_type = ["MODFILE_CHANGED", "MOD_UNAVAILABLE", "MOD_DELETED"];
            const path = `/games/${MODIO_GAME_ID}/mods/events?mod_id-in=${modIds}&date_added-min=${dateAdded}&event_type-in=${event_type.join(",")}`;
            const data = await ModioApi.getRequest(path);
            return data.data as EventInfo[];
        } catch (e) {
            message.error(`${t("Fetch Events Error")}: ${e}`);
        }
    }

    public static async getModFiles(modId: number) {
        try {
            const path = `/games/${MODIO_GAME_ID}/mods/${modId}/files`;
            const data = await ModioApi.getRequest(path);
            return data.data as ModFile[];
        } catch (e) {
            message.error(`${t("Fetch Events Error")}: ${e}`);
        }
    }

    public static async downloadModFile(modInfo: ModListItem,
                                        onProgress?: (loaded: number, total: number) => void) {

        if (await CacheApi.checkCacheFile(modInfo.nameId, modInfo.usedVersion, modInfo.fileSize)) {
            modInfo.cachePath = await CacheApi.getModCachePath(modInfo.nameId, modInfo.usedVersion);
            onProgress(modInfo.fileSize, modInfo.fileSize);
            return modInfo;
        }

        if (modInfo.fileSize < 100 * 1024 * 1024) {
            const data = await DownloadApi.downloadFile(modInfo.downloadUrl, onProgress);
            modInfo.cachePath = await CacheApi.saveCacheFile(modInfo.nameId, modInfo.usedVersion, data);
        } else {
            modInfo.cachePath = await CacheApi.getModCachePath(modInfo.nameId, modInfo.usedVersion);
            await DownloadApi.downloadLargeFile(modInfo.downloadUrl, modInfo.cachePath, onProgress);
        }

        modInfo.downloadProgress = 100;
        onProgress(modInfo.fileSize, modInfo.fileSize);
        return modInfo;
    }

}
