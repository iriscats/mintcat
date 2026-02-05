/**
 * ModCat API 客户端
 * 
 * 提供与 modcat.top 网站的 API 交互功能
 * API 文档: https://modcat.top:8100/swagger/index.html
 */

import { message } from "antd";
import { t } from "i18next";
import { StorageAPI } from "@/storage";
import { CacheApi } from "@/apis/CacheApi";
import { DownloadApi } from "@/apis/DownloadApi";
import type { CompleteModData } from "@/storage/dao/ModDAO";
import type {
    ModcatResultEntity,
    ModcatUserEntity,
    ModcatModEntity,
    ModcatModListViewEntity,
    ModcatModListRequest,
    ModcatTypesEntity,
    ModcatDownloadProgressCallback,
} from "./types";

/** ModCat API 基础 URL */
const MODCAT_API_BASE_URL = "https://modcat.top:8089";

/** OAuth 平台标识 */
export const MODCAT_PLATFORM = "modcat";

/**
 * ModCat API 客户端类
 */
export class ModcatApi {
    /**
     * 获取 API 基础 URL
     */
    private static getBaseUrl(): string {
        return MODCAT_API_BASE_URL;
    }

    /**
     * 获取认证头
     */
    private static async getHeaders(): Promise<HeadersInit> {
        const oAuthDAO = await StorageAPI.getOAuths();
        const oAuthData = await oAuthDAO.getActiveUserOAuthByPlatform(MODCAT_PLATFORM);
        
        const headers: HeadersInit = {
            "Content-Type": "application/json",
        };
        
        if (oAuthData?.oauth) {
            // 按照 API 文档要求，格式为 "Bearer xxxxxxxx"
            headers["Authorization"] = `Bearer ${oAuthData.oauth}`;
        }
        
        return headers;
    }

    /**
     * 检查是否已登录
     */
    public static async isAuthenticated(): Promise<boolean> {
        const oAuthDAO = await StorageAPI.getOAuths();
        const oAuthData = await oAuthDAO.getActiveUserOAuthByPlatform(MODCAT_PLATFORM);
        return !!oAuthData?.oauth;
    }

    /**
     * 获取当前 Token
     */
    public static async getToken(): Promise<string | null> {
        const oAuthDAO = await StorageAPI.getOAuths();
        const oAuthData = await oAuthDAO.getActiveUserOAuthByPlatform(MODCAT_PLATFORM);
        return oAuthData?.oauth || null;
    }

    /**
     * 存储 Token
     */
    private static async storeToken(token: string): Promise<void> {
        const oAuthDAO = await StorageAPI.getOAuths();
        const userDAO = await StorageAPI.getUsers();
        const activeUser = await userDAO.getActiveUser();
        
        if (!activeUser) {
            throw new Error("No active user found");
        }
        
        await oAuthDAO.upsertOAuth(activeUser.id, MODCAT_PLATFORM, token);
    }

    /**
     * 清除 Token
     */
    public static async clearToken(): Promise<void> {
        const oAuthDAO = await StorageAPI.getOAuths();
        const userDAO = await StorageAPI.getUsers();
        const activeUser = await userDAO.getActiveUser();
        
        if (activeUser) {
            await oAuthDAO.deleteOAuthByUidAndPlatform(activeUser.id, MODCAT_PLATFORM);
        }
    }

    /**
     * 执行 POST 请求
     */
    private static async postRequest<T>(
        path: string, 
        body?: unknown,
        includeAuth: boolean = true
    ): Promise<ModcatResultEntity<T>> {
        const url = `${ModcatApi.getBaseUrl()}${path}`;
        const headers = includeAuth ? await ModcatApi.getHeaders() : {
            "Content-Type": "application/json",
        };
        
        const resp = await fetch(url, {
            method: "POST",
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });
        
        if (!resp.ok) {
            throw new Error(`Request failed: ${resp.status}`);
        }
        
        return await resp.json() as ModcatResultEntity<T>;
    }

    /**
     * 检查响应是否成功
     */
    private static isSuccess<T>(result: ModcatResultEntity<T>): boolean {
        return result.ResultCode === 200;
    }

    /**
     * 测试接口连通性
     */
    public static async ping(): Promise<boolean> {
        try {
            const result = await ModcatApi.postRequest<string>("/api/Login/Test", null, false);
            return true; // 如果请求成功就认为连通
        } catch (error) {
            console.warn("[ModcatApi] Ping failed:", error);
            return false;
        }
    }

    // ==================== 链接解析 API ====================

    /**
     * 解析 ModCat 链接，提取 modId
     * 支持格式: 
     * - https://modcat.top/#/modDetail?ModId=xxx-xxx-xxx
     * - https://modcat.top/#/modDetail?ModId=xxx-xxx-xxx&other=params
     */
    public static parseModLinks(link: string): string | undefined {
        if (!link) return undefined;
        
        const trimmedLink = link.trim();
        
        // 匹配 modcat.top 链接，从 URL 中提取 ModId 参数
        // 支持 ModId 在任意位置
        if (trimmedLink.includes('modcat.top') && trimmedLink.includes('ModId=')) {
            const modIdMatch = trimmedLink.match(/ModId=([a-zA-Z0-9-]+)/);
            if (modIdMatch) {
                return modIdMatch[1];
            }
        }
        
        return undefined;
    }

    /**
     * 检查链接是否为 ModCat 链接
     */
    public static isModcatLink(link: string): boolean {
        if (!link) return false;
        const trimmedLink = link.trim();
        return trimmedLink.includes('modcat.top') && trimmedLink.includes('ModId=');
    }

    /**
     * 生成 ModCat mod 链接
     */
    public static getModUrl(modId: string): string {
        return `https://modcat.top/#/modDetail?ModId=${modId}`;
    }

    /**
     * 通过链接获取 Mod 信息
     */
    public static async getModInfoByLink(url: string): Promise<ModcatModEntity | null> {
        const modId = ModcatApi.parseModLinks(url);
        if (!modId) {
            return null;
        }
        return await ModcatApi.getModDetail(modId);
    }

    // ==================== 用户相关 API ====================

    /**
     * 获取当前用户信息
     */
    public static async getUserInfo(): Promise<ModcatUserEntity | null> {
        try {
            const result = await ModcatApi.postRequest<ModcatUserEntity>("/api/User/GetUserByUserId");
            
            if (!ModcatApi.isSuccess(result)) {
                throw new Error(result.ResultMsg || "Get user info failed");
            }
            
            return result.ResultData || null;
        } catch (error) {
            console.error("[ModcatApi] Get user info failed:", error);
            return null;
        }
    }

    // ==================== 游戏相关 API ====================

    /**
     * 获取 Deep Rock Galactic 游戏 ID
     */
    public static async getDrgGameId(): Promise<string> {
        return "drg";
    }

    // ==================== Mod 相关 API ====================

    /**
     * 获取 Mod 类型列表
     */
    public static async getModTypes(gameId?: string): Promise<ModcatTypesEntity[]> {
        try {
            const gid = gameId || await ModcatApi.getDrgGameId();
            const result = await ModcatApi.postRequest<ModcatTypesEntity[]>(
                "/api/Mod/GetAllModTypes",
                { GameId: gid || "" }
            );
            
            if (!ModcatApi.isSuccess(result)) {
                return [];
            }
            
            return result.ResultData || [];
        } catch (error) {
            console.error("[ModcatApi] Get mod types failed:", error);
            return [];
        }
    }

    /**
     * 分页获取 Mod 列表
     */
    public static async getModListPage(
        skip: number = 0,
        take: number = 20,
        search?: string,
        types?: string[],
        gameId?: string
    ): Promise<ModcatModListViewEntity[]> {
        try {
            const gid = gameId || await ModcatApi.getDrgGameId();
            const request: ModcatModListRequest = {
                Skip: String(skip),
                Take: String(take),
                GameId: gid || undefined,
            };
            
            if (search) {
                request.Search = search;
            }
            if (types && types.length > 0) {
                request.Types = types;
            }
            
            const result = await ModcatApi.postRequest<ModcatModListViewEntity[]>(
                "/api/Mod/ModListPage",
                request
            );
            
            if (!ModcatApi.isSuccess(result)) {
                return [];
            }
            
            return result.ResultData || [];
        } catch (error) {
            console.error("[ModcatApi] Get mod list failed:", error);
            return [];
        }
    }

    /**
     * 获取 Mod 列表（统一使用 /api/Mod/ModListPage 接口）
     */
    public static async getModList(
        page: number = 0,
        pageSize: number = 20,
        query?: string
    ): Promise<ModcatModListViewEntity[]> {
        return await ModcatApi.getModListPage(page * pageSize, pageSize, query);
    }

    /**
     * 获取 Mod 详情
     */
    public static async getModDetail(modId: string): Promise<ModcatModEntity | null> {
        try {
            const result = await ModcatApi.postRequest<ModcatModEntity>(
                "/api/Mod/ModDetail",
                { ModId: modId }
            );
            
            if (!ModcatApi.isSuccess(result)) {
                throw new Error(result.ResultMsg || "Get mod detail failed");
            }
            
            return result.ResultData || null;
        } catch (error) {
            console.error("[ModcatApi] Get mod detail failed:", error);
            message.error(`${t("Fetch Mod Info Error")}: ${error}`);
            return null;
        }
    }

    // ==================== 订阅相关 API ====================
    /**
     * 获取已订阅的 Mod 列表
     */
    public static async getSubscribedMods(
        skip: number = 0,
        take: number = 100,
        search?: string,
        types?: string[]
    ): Promise<ModcatModEntity[]> {
        try {
            const result = await ModcatApi.postRequest<ModcatModEntity[]>(
                "/api/User/UserAllSubscribeModPage",
                {
                    Skip: String(skip),
                    Take: String(take),
                    Select: search || "",
                    Types: types || [],
                }
            );
            
            if (!ModcatApi.isSuccess(result)) {
                return [];
            }
            
            return result.ResultData || [];
        } catch (error) {
            console.error("[ModcatApi] Get subscribed mods failed:", error);
            return [];
        }
    }

    // ==================== 下载相关 API ====================

    /**
     * 获取文件下载 URL
     */
    public static getDownloadUrl(fileId: string, noCount: boolean = true): string {
        return `${ModcatApi.getBaseUrl()}/api/Files/DownloadFileGet?FileId=${encodeURIComponent(fileId)}&NoCount=${noCount}`;
    }

    /**
     * 下载 Mod 文件
     */
    public static async downloadModFile(
        mod: ModcatModEntity,
        onProgress?: ModcatDownloadProgressCallback
    ): Promise<ModcatModEntity & { cachePath?: string }> {
        // 获取最新版本 - 放宽过滤条件，只要有 FilesId 就可以下载
        const latestVersion = mod.ModVersionEntities
            ?.filter(v => v.FilesId) // 只要有文件 ID 就可以
            .sort((a, b) => {
                const dateA = new Date(a.CreatedAt || 0).getTime();
                const dateB = new Date(b.CreatedAt || 0).getTime();
                return dateB - dateA;
            })[0];
        
        if (!latestVersion?.FilesId) {
            throw new Error(t("No downloadable version available") || "No downloadable version available");
        }
        
        const fileName = mod.Name || mod.ModId || "unknown";
        const version = latestVersion.VersionNumber || "latest";
        const fileSize = parseInt(latestVersion.Files?.Size || "0", 10);
        
        // 检查缓存
        if (await CacheApi.checkCacheFile(fileName, version, fileSize)) {
            const cachePath = await CacheApi.getModCachePath(fileName, version);
            onProgress?.(fileSize, fileSize);
            return { ...mod, cachePath };
        }
        
        // 下载文件
        const downloadUrl = ModcatApi.getDownloadUrl(latestVersion.FilesId);
        const cachePath = await CacheApi.getModCachePath(fileName, version);
        
        // 获取认证token
        const token = await ModcatApi.getToken();
        const headers: Record<string, string> = {};
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }
        
        await DownloadApi.downloadFile(
            downloadUrl,
            cachePath,
            { resume: true, retryCount: 3, headers },
            (downloaded, total) => {
                onProgress?.(downloaded, total);
            }
        );
        
        onProgress?.(fileSize, fileSize);
        return { ...mod, cachePath };
    }

    /**
     * 将 ModcatModListViewEntity 转换为 ModcatModEntity 格式
     */
    public static listViewToModEntity(view: ModcatModListViewEntity): ModcatModEntity {
        return {
            ModId: view.ModId,
            Name: view.Name,
            PicUrl: view.PicUrl,
            ModTypeEntities: view.ModTypeEntities?.map(t => ({
                TypesId: t.TypesId,
                Types: { TypesId: t.TypesId, TypeName: t.TypeName },
            })),
            IsMySubscribe: view.IsMySubscribe ?? undefined,
            AVGPoint: view.AVGPoint ?? undefined,
        };
    }

    /**
     * 将 ModcatModEntity 转换为 CompleteModData 格式
     * 注意：返回的是部分数据，需要补充 gameId 等必需字段后才能存入数据库
     */
    public static toCompleteModData(mod: ModcatModEntity): Partial<CompleteModData> {
        // 获取最新版本
        const latestVersion = mod.ModVersionEntities
            ?.filter(v => v.Status === "Approved" && v.FilesId)
            .sort((a, b) => {
                const dateA = new Date(a.CreatedAt || 0).getTime();
                const dateB = new Date(b.CreatedAt || 0).getTime();
                return dateB - dateA;
            })[0];
        
        // 由于 CompleteModData 需要 modId，这里暂时使用 0
        // 实际使用时应该在数据库中创建记录后获取真实 ID
        const placeholderModId = 0;
        
        return {
            nameId: mod.ModId || "",
            displayName: mod.Name || "",
            originalName: mod.Name,
            url: ModcatApi.getModUrl(mod.ModId || ""),
            sourceType: MODCAT_PLATFORM,
            platformId: 0, // modcat 使用字符串 ID
            tags: mod.ModTypeEntities?.map(t => t.Types?.TypeName).filter(Boolean) as string[] || [],
            download: latestVersion?.FilesId ? {
                modId: placeholderModId,
                downloadUrl: ModcatApi.getDownloadUrl(latestVersion.FilesId),
                fileSize: parseInt(latestVersion.Files?.Size || "0", 10),
            } : undefined,
            version: latestVersion ? {
                modId: placeholderModId,
                currentVersion: latestVersion.VersionNumber || "",
            } : undefined,
        };
    }
}

// 导出类型
export * from "./types";
