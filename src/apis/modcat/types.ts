/**
 * ModCat API 类型定义
 * 
 * 基于 modcat.top 网站 API 的数据结构定义
 * API 文档: https://modcat.top:8100/swagger/index.html
 */

// ==================== 通用响应类型 ====================

/**
 * API 通用响应结构
 */
export interface ModcatResultEntity<T> {
    resultCode: number;
    resultMsg?: string;
    resultData?: T;
}

// ==================== 用户相关类型 ====================

/**
 * 用户实体
 */
export interface ModcatUserEntity {
    userId?: string;
    nickName?: string;
    mail?: string;
    headPic?: string;
    createdAt?: string;
    feedBackMail?: string;
    userRoleID?: string[];
}

/**
 * 登录响应 Token
 */
export interface ModcatResponseToken {
    /** JWT Token */
    token?: string;
    /** 用于刷新 token 的刷新令牌 */
    refresh_Token?: string;
    /** 昵称 */
    nickName?: string;
    /** 角色 */
    role?: string;
    /** 头像 url */
    headPic?: string;
}

/**
 * 登录请求
 */
export interface ModcatLoginRequest {
    LoginAccount: string;
    Password: string;
}

/**
 * 注册请求
 */
export interface ModcatRegisterRequest {
    LoginAccount: string;
    NickName: string;
    Password: string;
}

/**
 * Token 刷新请求
 */
export interface ModcatRefreshTokenRequest {
    Token: string;
    RefreshToken: string;
}

// ==================== 游戏相关类型 ====================

/**
 * 游戏实体
 */
export interface ModcatGameEntity {
    gameId?: string;
    gameName?: string;
    picture?: string;
    icon?: string;
    downLoadCount?: number;
    subscribeCount?: number;
}

// ==================== Mod 相关类型 ====================

/**
 * Mod 类型实体
 */
export interface ModcatTypesEntity {
    typesId?: string;
    typeName?: string;
    sort?: number;
    gameId?: string;
}

/**
 * Mod 类型列表视图实体
 */
export interface ModcatModTypesListViewEntity {
    typesId?: string;
    typeName?: string;
}

/**
 * Mod 版本实体
 */
export interface ModcatModVersionEntity {
    versionId?: string;
    modId?: string;
    versionNumber?: string;
    description?: string;
    filesId?: string;
    createdAt?: string;
    updatedAt?: string;
    status?: string;
    files?: ModcatFilesEntity;
}

/**
 * 文件实体
 */
export interface ModcatFilesEntity {
    filesId?: string;
    filesType?: string;
    filesName?: string;
    size?: string;
    path?: string;
    userId?: string;
    createdAt?: string;
    softDeleted?: boolean;
}

/**
 * Mod 依赖实体
 */
export interface ModcatModDependenceEntity {
    modDependenceId?: string;
    modId?: string;
    dependenceModVersionId?: string;
    modIOURL?: string;
    dependenceModVersion?: ModcatModVersionEntity;
}

/**
 * Mod 图片实体
 */
export interface ModcatModPictureEntity {
    pictureId?: string;
    modId?: string;
    url?: string;
    description?: string;
}

/**
 * Mod 评分实体
 */
export interface ModcatModPointEntity {
    modPointId?: string;
    modId?: string;
    userId?: string;
    point?: number;
    reason?: string;
    createdAt?: string;
}

/**
 * Mod 实体（完整）
 */
export interface ModcatModEntity {
    modId?: string;
    name?: string;
    description?: string;
    creatorUserId?: string;
    createdAt?: string;
    updatedAt?: string;
    videoUrl?: string;
    downloadCount?: number;
    softDeleted?: boolean;
    picUrl?: string;
    gameId?: string;
    modPictureEntities?: ModcatModPictureEntity[];
    modTypeEntities?: ModcatModTypeEntity[];
    modVersionEntities?: ModcatModVersionEntity[];
    creatorEntity?: ModcatUserEntity;
    modPointEntities?: ModcatModPointEntity[];
    modDependenceEntities?: ModcatModDependenceEntity[];
    gameEntity?: ModcatGameEntity;
    isMySubscribe?: boolean;
    avgPoint?: number;
}

/**
 * Mod 类型关联实体
 */
export interface ModcatModTypeEntity {
    modTypeId?: string;
    modId?: string;
    typesId?: string;
    types?: ModcatTypesEntity;
}

/**
 * Mod 列表视图实体（精简）
 */
export interface ModcatModListViewEntity {
    modId?: string;
    name?: string;
    picUrl?: string;
    modTypeEntities?: ModcatModTypesListViewEntity[];
    isMySubscribe?: boolean;
    avgPoint?: number;
}

// ==================== 请求参数类型 ====================

/**
 * Mod 列表请求参数
 */
export interface ModcatModListRequest {
    Skip: string;
    Take: string;
    Search?: string;
    Types?: string[];
    GameId?: string;
}

/**
 * Mod 详情请求参数
 */
export interface ModcatModDetailRequest {
    ModId: string;
}

/**
 * 订阅请求参数
 */
export interface ModcatSubscribeRequest {
    ModId: string;
}

/**
 * 分页请求参数
 */
export interface ModcatPageRequest {
    Skip: string;
    Take: string;
}

// ==================== 下载相关类型 ====================

/**
 * 下载进度回调
 */
export type ModcatDownloadProgressCallback = (
    downloaded: number,
    total: number,
    speed?: number
) => void;

// ==================== Deep Rock Galactic 游戏 ID ====================

/** DRG 游戏 ID - 需要确认实际值 */
export const MODCAT_DRG_GAME_ID = ""; // 需要从 GetGamePageList 获取
