import {message} from "antd";
import {t} from "i18next";
import {emitEvent} from "@/events";
import type {CompleteModData} from "@/storage/dao/ModDAO";
import {UserInfo} from "@/apis/modio/UserInfo.ts";
import {EventInfo} from "@/apis/modio/EventInfo.ts";
import {CacheApi} from "@/apis/CacheApi.ts";
import {DownloadApi} from "@/apis/DownloadApi.ts";
import {NetworkApi} from "@/apis/NetworkApi.ts";
import {ModFile, ModInfo, Tags} from "@/apis/modio/ModInfo.ts";
import {TimeUtils} from "@/utils/TimeUtils.ts";
import {StorageAPI} from "@/storage";

//const MODIO_API_URL = "https://api.mod.io/v1";
const MODIO_GAME_ID = 2475;
const MODIO_UID = "13595141";

export class ModioApi {

    private static async getHost() {
        const oAuthDAO = await StorageAPI.getOAuths();
        const oAuthData = await oAuthDAO.getActiveUserOAuthByPlatform('mod.io');
        const modioUid = oAuthData?.uid ?? MODIO_UID;
        return `https://u-${modioUid}.modapi.io/v1`;
    }

    private static async getHeaders() {
        const oAuthDAO = await StorageAPI.getOAuths();
        const oAuthData = await oAuthDAO.getActiveUserOAuthByPlatform('mod.io');
        return {
            Authorization: `Bearer ${oAuthData?.oauth ?? ""}`,
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
        return modData;
    }

    public static async getUserInfo() {
        try {
            const oAuthDAO = await StorageAPI.getOAuths();
            const oAuthData = await oAuthDAO.getActiveUserOAuthByPlatform('mod.io');
            if (!oAuthData?.oauth?.trim()) {
                return undefined;
            }
            const path = "/me";
            const data = await ModioApi.getRequest(path);
            return data as UserInfo;
        } catch (e) {
            const msg = `${t("Fetch User Info Error")}: ${e}`;
            await emitEvent("modio-unauthorized", msg);
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
            if (data["data"].length === 0)
                return;
            else {
                return data["data"][0];
            }
        } catch (e) {
            message.error(`${t("Fetch Mod Info Error")}: ${e}`);
            throw e;
        }
    }

    public static async getModInfoByNameList(
        nameIds: string[],
        batchSize: number = 20
    ): Promise<ModInfo[]> {
        try {
            const normalized = nameIds.filter(Boolean);
            if (normalized.length === 0) {
                return [];
            }

            const results: ModInfo[] = [];

            // 分批处理，避免 URL 过长和 API 限制
            for (let i = 0; i < normalized.length; i += batchSize) {
                const batch = normalized.slice(i, i + batchSize);
                const path = `/games/${MODIO_GAME_ID}/mods?name_id-in=${encodeURIComponent(batch.join(","))}`;
                const data = await ModioApi.getRequest(path);
                results.push(...(data.data as ModInfo[]));
            }

            return results;
        } catch (e) {
            message.error(`${t("Fetch Mod Info Error")}: ${e}`);
            throw e;
        }
    }

    /**
     * 通过 platformId（mod.io 的 id）批量获取 mod 信息
     * @param modIds mod.io 平台 ID 列表
     * @param batchSize 每批数量，默认 20
     */
    public static async getModInfoByIdList(
        modIds: number[],
        batchSize: number = 20
    ): Promise<ModInfo[]> {
        try {
            if (modIds.length === 0) {
                return [];
            }

            const results: ModInfo[] = [];

            // 分批处理，避免 URL 过长和 API 限制
            for (let i = 0; i < modIds.length; i += batchSize) {
                const batch = modIds.slice(i, i + batchSize);
                const path = `/games/${MODIO_GAME_ID}/mods?id-in=${batch.join(",")}`;
                const data = await ModioApi.getRequest(path);
                results.push(...(data.data as ModInfo[]));
            }

            return results;
        } catch (e) {
            message.error(`${t("Fetch Mod Info Error")}: ${e}`);
            throw e;
        }
    }

    /**
     * 获取单个 mod 的标签（Get Mod Tags）
     * 列表接口可能不返回 tags，一键更新时需单独拉取以刷新标签
     * @see https://docs.mod.io/restapi/docs/get-mod-tags
     */
    public static async getModTags(platformModId: number): Promise<Tags[]> {
        try {
            const path = `/games/${MODIO_GAME_ID}/mods/${platformModId}/tags`;
            const data = await ModioApi.getRequest(path);
            const list = data?.data ?? [];
            if (!Array.isArray(list)) return [];
            return list.map((t: any) => ({
                name: t.name ?? "",
                name_localized: t.name_localized ?? t.name ?? "",
                date_added: t.date_added ?? 0
            }));
        } catch (e) {
            console.warn("[ModioApi] getModTags failed for mod", platformModId, e);
            return [];
        }
    }

    /**
     * 将 sortBy + sortOrder 映射为 mod.io Get Mods 的 _sort 值
     * @see https://docs.mod.io/restapiref/#get-mods
     */
    private static getModListSortParam(
        sortBy?: 'downloads' | 'subscribers' | 'rating' | 'date' | 'name',
        sortOrder?: 'asc' | 'desc'
    ): string | undefined {
        if (!sortBy || !sortOrder) return undefined;
        const desc = sortOrder === 'desc';
        const map: Record<string, string> = {
            date: desc ? '-date_updated' : 'date_updated',
            downloads: desc ? '-downloads_total' : 'downloads_total',
            subscribers: desc ? '-subscribers_total' : 'subscribers_total',
            rating: desc ? '-ratings_weighted_aggregate' : 'ratings_weighted_aggregate',
            name: desc ? '-name' : 'name',
        };
        return map[sortBy];
    }

    public static async getModList(
        pageNo: number = 0,
        pageSize: number = 20,
        name: string = undefined,
        sortBy?: 'downloads' | 'subscribers' | 'rating' | 'date' | 'name',
        sortOrder?: 'asc' | 'desc'
    ): Promise<ModInfo[]> {
        try {
            const params = new URLSearchParams();
            params.set('_limit', String(pageSize));
            params.set('_offset', String(pageSize * pageNo));
            if (name) {
                params.set('name-lk', `*${name}*`);
            }
            const sortParam = ModioApi.getModListSortParam(sortBy, sortOrder);
            if (sortParam) {
                params.set('_sort', sortParam);
            }
            const path = `/games/${MODIO_GAME_ID}/mods?${params.toString()}`;
            const data = await ModioApi.getRequest(path);
            return data.data as ModInfo[];
        } catch (e) {
            message.error(`${t("Fetch Mod Info Error")}: ${e}`);
            return [];
        }
    }

    /** 获取当前用户订阅的 mod 列表（需已登录 mod.io） */
    public static async getSubscribedMods(pageNo: number = 0, pageSize: number = 100): Promise<ModInfo[]> {
        try {
            const path = `/me/subscribed?game_id=${MODIO_GAME_ID}&_limit=${pageSize}&_offset=${pageSize * pageNo}`;
            const data = await ModioApi.getRequest(path);
            return (data.data ?? data) as ModInfo[];
        } catch (e) {
            message.error(`${t("Fetch Subscribed Mods Error")}: ${e}`);
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
            if (TimeUtils.nowSeconds() - dateAdded < 10 * 60) {
                return [];
            }

            const event_type = ["MODFILE_CHANGED", "MOD_UNAVAILABLE", "MOD_DELETED"];
            const path = `/games/${MODIO_GAME_ID}/mods/events?mod_id-in=${modIds}&date_added-min=${dateAdded}&event_type-in=${event_type.join(",")}`;
            const data = await ModioApi.getRequest(path);
            return data.data as EventInfo[];
        } catch (e) {
            message.error(`${t("Fetch Events Error")}: ${e}`);
            return [];
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

    /**
     * 下载 mod 文件。先用数据库中的下载地址尝试，失败（如链接过期）后再拉取最新 binary_url 重试一次。
     */
    public static async downloadModFile(modInfo: CompleteModData,
                                        onProgress?: (loaded: number, total: number) => void) {
        const fileName = modInfo.nameId;
        const version = modInfo.version?.currentVersion || "-";
        let fileSize = modInfo.download?.fileSize || 0;
        let downloadUrl = modInfo.download?.downloadUrl || "";

        // 数据库没有链接时必须先拉取一次
        if (!downloadUrl) {
            const freshInfo = await ModioApi.getModInfoByName(modInfo.nameId);
            if (freshInfo?.modfile?.download?.binary_url) {
                downloadUrl = freshInfo.modfile.download.binary_url;
                if (freshInfo.modfile.filesize) fileSize = freshInfo.modfile.filesize;
            } else {
                throw new Error(t("Fetch Mod Info Error") || "无法获取模组信息，请检查模组链接或网络");
            }
        }

        if (await CacheApi.checkCacheFile(fileName, version, fileSize)) {
            const cachePath = await CacheApi.getModCachePath(fileName, version);
            onProgress?.(fileSize, fileSize);
            return { ...modInfo, download: { ...modInfo.download!, cachePath, downloadProgress: 100 } };
        }

        const cachePath = await CacheApi.getModCachePath(fileName, version);
        const doDownload = (url: string) =>
            DownloadApi.downloadFile(
                url,
                cachePath,
                { resume: true, retryCount: 3 },
                (downloaded, total) => onProgress?.(downloaded, total)
            );

        try {
            await doDownload(downloadUrl);
        } catch (firstError) {
            // 先用数据库地址试一次，失败后再获取最新链接重试（mod.io binary_url 会过期）
            const freshInfo = await ModioApi.getModInfoByName(modInfo.nameId);
            const freshUrl = freshInfo?.modfile?.download?.binary_url;
            if (freshUrl) {
                if (freshInfo.modfile.filesize) fileSize = freshInfo.modfile.filesize;
                await doDownload(freshUrl);
            } else {
                throw firstError;
            }
        }

        onProgress?.(fileSize, fileSize);
        return { ...modInfo, download: { ...modInfo.download!, cachePath, downloadProgress: 100 } };
    }

}
