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
    ModcatResponseToken,
    ModcatLoginRequest,
    ModcatRegisterRequest,
    ModcatRefreshTokenRequest,
    ModcatModEntity,
    ModcatModListViewEntity,
    ModcatModListRequest,
    ModcatGameEntity,
    ModcatTypesEntity,
    ModcatDownloadProgressCallback,
} from "./types";

/** ModCat API 基础 URL */
const MODCAT_API_BASE_URL = "https://modcat.top:8089";

/** OAuth 平台标识 */
export const MODCAT_PLATFORM = "modcat";

/** Deep Rock Galactic 游戏名称 */
const DRG_GAME_NAME = "Deep Rock Galactic";

/** 缓存的 DRG 游戏 ID */
let cachedDrgGameId: string | null = null;

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
        return result.resultCode === 200;
    }

    // ==================== 登录相关 API ====================

    /**
     * 用户登录
     * @param email 邮箱
     * @param password 密码
     */
    public static async login(email: string, password: string): Promise<ModcatResponseToken | null> {
        try {
            const request: ModcatLoginRequest = {
                LoginAccount: email,
                Password: password,
            };
            
            const result = await ModcatApi.postRequest<ModcatResponseToken>(
                "/api/Login/UserLogin",
                request,
                false
            );
            
            if (!ModcatApi.isSuccess(result)) {
                throw new Error(result.resultMsg || "Login failed");
            }
            
            if (result.resultData?.token) {
                await ModcatApi.storeToken(result.resultData.token);
            }
            
            return result.resultData || null;
        } catch (error) {
            console.error("[ModcatApi] Login failed:", error);
            throw error;
        }
    }

    /**
     * 用户注册并登录
     * @param email 邮箱
     * @param nickname 昵称
     * @param password 密码
     */
    public static async register(
        email: string, 
        nickname: string, 
        password: string
    ): Promise<ModcatResponseToken | null> {
        try {
            const request: ModcatRegisterRequest = {
                LoginAccount: email,
                NickName: nickname,
                Password: password,
            };
            
            const result = await ModcatApi.postRequest<ModcatResponseToken>(
                "/api/Login/UserRegister",
                request,
                false
            );
            
            if (!ModcatApi.isSuccess(result)) {
                throw new Error(result.resultMsg || "Register failed");
            }
            
            if (result.resultData?.token) {
                await ModcatApi.storeToken(result.resultData.token);
            }
            
            return result.resultData || null;
        } catch (error) {
            console.error("[ModcatApi] Register failed:", error);
            throw error;
        }
    }

    /**
     * 刷新 Token
     */
    public static async refreshToken(token: string, refreshToken: string): Promise<ModcatResponseToken | null> {
        try {
            const request: ModcatRefreshTokenRequest = {
                Token: token,
                RefreshToken: refreshToken,
            };
            
            const result = await ModcatApi.postRequest<ModcatResponseToken>(
                "/api/Login/RefreshToken",
                request,
                false
            );
            
            if (!ModcatApi.isSuccess(result)) {
                throw new Error(result.resultMsg || "Refresh token failed");
            }
            
            if (result.resultData?.token) {
                await ModcatApi.storeToken(result.resultData.token);
            }
            
            return result.resultData || null;
        } catch (error) {
            console.error("[ModcatApi] Refresh token failed:", error);
            throw error;
        }
    }

    /**
     * 创建长期 Token (80年)
     */
    public static async createLongLivedToken(email: string, password: string): Promise<ModcatResponseToken | null> {
        try {
            const request: ModcatLoginRequest = {
                LoginAccount: email,
                Password: password,
            };
            
            const result = await ModcatApi.postRequest<ModcatResponseToken>(
                "/api/Login/CreateToken",
                request,
                false
            );
            
            if (!ModcatApi.isSuccess(result)) {
                throw new Error(result.resultMsg || "Create token failed");
            }
            
            if (result.resultData?.token) {
                await ModcatApi.storeToken(result.resultData.token);
            }
            
            return result.resultData || null;
        } catch (error) {
            console.error("[ModcatApi] Create long-lived token failed:", error);
            throw error;
        }
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

    // ==================== 用户相关 API ====================

    /**
     * 获取当前用户信息
     */
    public static async getUserInfo(): Promise<ModcatUserEntity | null> {
        try {
            const result = await ModcatApi.postRequest<ModcatUserEntity>("/api/User/GetUserByUserId");
            
            if (!ModcatApi.isSuccess(result)) {
                throw new Error(result.resultMsg || "Get user info failed");
            }
            
            return result.resultData || null;
        } catch (error) {
            console.error("[ModcatApi] Get user info failed:", error);
            return null;
        }
    }

    // ==================== 游戏相关 API ====================

    /**
     * 获取游戏列表
     */
    public static async getGameList(skip: number = 0, take: number = 100): Promise<ModcatGameEntity[]> {
        try {
            const result = await ModcatApi.postRequest<ModcatGameEntity[]>(
                "/api/Game/GetGamePageList",
                { Skip: String(skip), Take: String(take) },
                false
            );
            
            if (!ModcatApi.isSuccess(result)) {
                return [];
            }
            
            return result.resultData || [];
        } catch (error) {
            console.error("[ModcatApi] Get game list failed:", error);
            return [];
        }
    }

    /**
     * 获取 Deep Rock Galactic 游戏 ID
     */
    public static async getDrgGameId(): Promise<string | null> {
        if (cachedDrgGameId) {
            return cachedDrgGameId;
        }
        
        try {
            const games = await ModcatApi.getGameList();
            const drg = games.find(g => 
                g.gameName?.toLowerCase().includes("deep rock") ||
                g.gameName?.toLowerCase().includes("drg")
            );
            
            if (drg?.gameId) {
                cachedDrgGameId = drg.gameId;
                return cachedDrgGameId;
            }
            
            // 如果没找到，返回第一个游戏
            if (games.length > 0) {
                cachedDrgGameId = games[0].gameId || null;
                return cachedDrgGameId;
            }
            
            return null;
        } catch (error) {
            console.error("[ModcatApi] Get DRG game ID failed:", error);
            return null;
        }
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
            
            return result.resultData || [];
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
            
            return result.resultData || [];
        } catch (error) {
            console.error("[ModcatApi] Get mod list failed:", error);
            return [];
        }
    }

    /**
     * 搜索 Mod（专用搜索接口）
     */
    public static async searchMods(
        search: string,
        skip: number = 0,
        take: number = 20
    ): Promise<ModcatModEntity[]> {
        try {
            const result = await ModcatApi.postRequest<ModcatModEntity[]>(
                "/api/Mod/ModListPageSearch",
                { Skip: String(skip), Take: String(take), Search: search }
            );
            
            if (!ModcatApi.isSuccess(result)) {
                return [];
            }
            
            return result.resultData || [];
        } catch (error) {
            console.error("[ModcatApi] Search mods failed:", error);
            return [];
        }
    }

    /**
     * 获取 Mod 列表（兼容旧接口）
     */
    public static async getModList(
        page: number = 0,
        pageSize: number = 20,
        query?: string
    ): Promise<ModcatModListViewEntity[]> {
        if (query) {
            // 搜索时使用专用搜索接口
            const mods = await ModcatApi.searchMods(query, page * pageSize, pageSize);
            // 转换为 ListView 格式
            return mods.map(mod => ({
                modId: mod.modId,
                name: mod.name,
                picUrl: mod.picUrl,
                modTypeEntities: mod.modTypeEntities?.map(t => ({
                    typesId: t.typesId,
                    typeName: t.types?.typeName,
                })),
                isMySubscribe: mod.isMySubscribe,
                avgPoint: mod.avgPoint,
            }));
        }
        return await ModcatApi.getModListPage(page * pageSize, pageSize);
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
                throw new Error(result.resultMsg || "Get mod detail failed");
            }
            
            return result.resultData || null;
        } catch (error) {
            console.error("[ModcatApi] Get mod detail failed:", error);
            message.error(`${t("Fetch Mod Info Error")}: ${error}`);
            return null;
        }
    }

    // ==================== 订阅相关 API ====================

    /**
     * 订阅 Mod
     */
    public static async subscribeMod(modId: string): Promise<boolean> {
        try {
            const result = await ModcatApi.postRequest<boolean>(
                "/api/User/ModSubscribe",
                { ModId: modId }
            );
            
            return ModcatApi.isSuccess(result) && result.resultData === true;
        } catch (error) {
            console.error("[ModcatApi] Subscribe mod failed:", error);
            return false;
        }
    }

    /**
     * 取消订阅 Mod
     */
    public static async unsubscribeMod(modId: string): Promise<boolean> {
        try {
            const result = await ModcatApi.postRequest<boolean>(
                "/api/User/UserUnsubscribeMod",
                { ModId: modId }
            );
            
            return ModcatApi.isSuccess(result) && result.resultData === true;
        } catch (error) {
            console.error("[ModcatApi] Unsubscribe mod failed:", error);
            return false;
        }
    }

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
            
            return result.resultData || [];
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
        return `${ModcatApi.getBaseUrl()}/api/Files/DownloadFileGet?fileId=${encodeURIComponent(fileId)}&noCount=${noCount}`;
    }

    /**
     * 下载 Mod 文件
     */
    public static async downloadModFile(
        mod: ModcatModEntity,
        onProgress?: ModcatDownloadProgressCallback
    ): Promise<ModcatModEntity & { cachePath?: string }> {
        // 获取最新版本
        const latestVersion = mod.modVersionEntities
            ?.filter(v => v.status === "Approved" && v.filesId)
            .sort((a, b) => {
                const dateA = new Date(a.createdAt || 0).getTime();
                const dateB = new Date(b.createdAt || 0).getTime();
                return dateB - dateA;
            })[0];
        
        if (!latestVersion?.filesId) {
            throw new Error(t("No downloadable version available") || "No downloadable version available");
        }
        
        const fileName = mod.name || mod.modId || "unknown";
        const version = latestVersion.versionNumber || "latest";
        const fileSize = parseInt(latestVersion.files?.size || "0", 10);
        
        // 检查缓存
        if (await CacheApi.checkCacheFile(fileName, version, fileSize)) {
            const cachePath = await CacheApi.getModCachePath(fileName, version);
            onProgress?.(fileSize, fileSize);
            return { ...mod, cachePath };
        }
        
        // 下载文件
        const downloadUrl = ModcatApi.getDownloadUrl(latestVersion.filesId);
        const cachePath = await CacheApi.getModCachePath(fileName, version);
        
        await DownloadApi.downloadFile(
            downloadUrl,
            cachePath,
            { resume: true, retryCount: 3 },
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
            modId: view.modId,
            name: view.name,
            picUrl: view.picUrl,
            modTypeEntities: view.modTypeEntities?.map(t => ({
                typesId: t.typesId,
                types: { typesId: t.typesId, typeName: t.typeName },
            })),
            isMySubscribe: view.isMySubscribe,
            avgPoint: view.avgPoint,
        };
    }

    /**
     * 将 ModcatModEntity 转换为 CompleteModData 格式
     * 注意：返回的是部分数据，需要补充 gameId 等必需字段后才能存入数据库
     */
    public static toCompleteModData(mod: ModcatModEntity): Partial<CompleteModData> {
        // 获取最新版本
        const latestVersion = mod.modVersionEntities
            ?.filter(v => v.status === "Approved" && v.filesId)
            .sort((a, b) => {
                const dateA = new Date(a.createdAt || 0).getTime();
                const dateB = new Date(b.createdAt || 0).getTime();
                return dateB - dateA;
            })[0];
        
        // 由于 CompleteModData 需要 modId，这里暂时使用 0
        // 实际使用时应该在数据库中创建记录后获取真实 ID
        const placeholderModId = 0;
        
        return {
            nameId: mod.modId || "",
            displayName: mod.name || "",
            originalName: mod.name,
            url: `https://modcat.top/mod/${mod.modId}`,
            sourceType: MODCAT_PLATFORM,
            platformId: 0, // modcat 使用字符串 ID
            tags: mod.modTypeEntities?.map(t => t.types?.typeName).filter(Boolean) as string[] || [],
            download: latestVersion?.filesId ? {
                modId: placeholderModId,
                downloadUrl: ModcatApi.getDownloadUrl(latestVersion.filesId),
                fileSize: parseInt(latestVersion.files?.size || "0", 10),
            } : undefined,
            version: latestVersion ? {
                modId: placeholderModId,
                currentVersion: latestVersion.versionNumber || "",
            } : undefined,
        };
    }
}

// 导出类型
export * from "./types";
