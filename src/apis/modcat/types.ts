/**
 * ModCat API 类型定义
 * 
 * 基于 modcat.top 网站 API 的数据结构定义
 * API 文档: https://modcat.top:8100/swagger/index.html
 * 
 * 注意：API 返回字段使用 Pascal Case
 */

// ==================== 通用响应类型 ====================

/**
 * API 通用响应结构
 */
export interface ModcatResultEntity<T> {
    ResultCode: number;
    ResultMsg?: string;
    ResultData?: T;
}

// ==================== 用户相关类型 ====================

/**
 * 用户实体
 */
export interface ModcatUserEntity {
    UserId?: string;
    NickName?: string;
    Mail?: string;
    HeadPic?: string;
    CreatedAt?: string;
    FeedBackMail?: string;
    UserRoleID?: string[];
}

/**
 * 登录响应 Token
 */
export interface ModcatResponseToken {
    /** JWT Token */
    Token?: string;
    /** 用于刷新 token 的刷新令牌 */
    Refresh_Token?: string;
    /** 昵称 */
    NickName?: string;
    /** 角色 */
    Role?: string;
    /** 头像 url */
    HeadPic?: string;
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
    GameId?: string;
    GameName?: string;
    Picture?: string;
    Icon?: string;
    DownLoadCount?: number;
    SubscribeCount?: number;
}

// ==================== Mod 相关类型 ====================

/**
 * Mod 类型实体
 */
export interface ModcatTypesEntity {
    TypesId?: string;
    TypeName?: string;
    Sort?: number;
    GameId?: string;
}

/**
 * Mod 类型列表视图实体
 */
export interface ModcatModTypesListViewEntity {
    TypesId?: string;
    TypeName?: string;
}

/**
 * Mod 版本实体
 */
export interface ModcatModVersionEntity {
    VersionId?: string;
    ModId?: string;
    VersionNumber?: string;
    Description?: string;
    FilesId?: string;
    CreatedAt?: string;
    UpdatedAt?: string;
    Status?: string;
    Files?: ModcatFilesEntity;
}

/**
 * 文件实体
 */
export interface ModcatFilesEntity {
    FilesId?: string;
    FilesType?: string;
    FilesName?: string;
    Size?: string;
    Path?: string;
    UserId?: string;
    CreatedAt?: string;
    SoftDeleted?: boolean;
}

/**
 * Mod 依赖实体
 */
export interface ModcatModDependenceEntity {
    ModDependenceId?: string;
    ModId?: string;
    DependenceModVersionId?: string;
    ModIOURL?: string;
    DependenceModVersion?: ModcatModVersionEntity;
}

/**
 * Mod 图片实体
 */
export interface ModcatModPictureEntity {
    PictureId?: string;
    ModId?: string;
    Url?: string;
    Description?: string;
}

/**
 * Mod 评分实体
 */
export interface ModcatModPointEntity {
    ModPointId?: string;
    ModId?: string;
    UserId?: string;
    Point?: number;
    Reason?: string;
    CreatedAt?: string;
}

/**
 * Mod 实体（完整）
 */
export interface ModcatModEntity {
    ModId?: string;
    Name?: string;
    Description?: string;
    CreatorUserId?: string;
    CreatedAt?: string;
    UpdatedAt?: string;
    VideoUrl?: string;
    DownloadCount?: number;
    SoftDeleted?: boolean;
    PicUrl?: string;
    GameId?: string;
    ModPictureEntities?: ModcatModPictureEntity[];
    ModTypeEntities?: ModcatModTypeEntity[];
    ModVersionEntities?: ModcatModVersionEntity[];
    CreatorEntity?: ModcatUserEntity;
    ModPointEntities?: ModcatModPointEntity[];
    ModDependenceEntities?: ModcatModDependenceEntity[];
    GameEntity?: ModcatGameEntity;
    IsMySubscribe?: boolean;
    AVGPoint?: number;
}

/**
 * Mod 类型关联实体
 */
export interface ModcatModTypeEntity {
    ModTypeId?: string;
    ModId?: string;
    TypesId?: string;
    Types?: ModcatTypesEntity;
}

/**
 * Mod 列表视图实体（精简）
 */
export interface ModcatModListViewEntity {
    ModId?: string;
    Name?: string;
    PicUrl?: string;
    ModTypeEntities?: ModcatModTypesListViewEntity[];
    IsMySubscribe?: boolean | null;
    AVGPoint?: number | null;
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
