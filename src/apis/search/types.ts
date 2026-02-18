/**
 * 通用搜索结果项接口
 * 支持多个搜索源的统一数据结构
 */
export interface SearchResultItem {
    /** 唯一标识符 */
    id: string;
    /** 平台 ID (例如 mod.io 的数字 ID) */
    platformId?: number;
    /** 名称 ID (例如 mod.io 的 name_id) */
    nameId: string;
    /** 显示名称 */
    name: string;
    /** 翻译后的名称 */
    nameTrans?: string;
    /** 摘要描述 */
    summary: string;
    /** 翻译后的摘要 */
    summaryTrans?: string;
    /** 详情链接 */
    profileUrl: string;
    /** 缩略图 URL */
    thumbnailUrl: string;
    /** 本地缓存的缩略图路径 */
    cachedThumbnailUrl?: string;
    /** 作者信息 */
    author: {
        id: number;
        name: string;
        avatarUrl: string;
        cachedAvatarUrl?: string;
    };
    /** 统计信息 */
    stats: {
        downloads: number;
        subscribers: number;
        rating?: number;
    };
    /** 标签 */
    tags?: string[];
    /** 来源平台标识 */
    source: SearchSource;
    /** 原始数据 (用于特定平台的额外操作) */
    rawData?: unknown;
}

/**
 * 搜索源枚举
 */
export enum SearchSource {
    MODIO = 'modio',
    MODCAT = 'modcat',
    NEXUSMODS = 'nexusmods',
    THUNDERSTORE = 'thunderstore',
    LOCAL = 'local',
}

/**
 * 搜索参数接口
 */
export interface SearchParams {
    /** 搜索关键词 */
    query?: string;
    /** 页码 (从 0 开始) */
    page: number;
    /** 每页数量 */
    pageSize: number;
    /** ModCat 平台游戏 ID（如 "drg" | "rc"），用于按当前游戏筛选 */
    modcatGameId?: string;
    /** 排序字段 */
    sortBy?: 'downloads' | 'subscribers' | 'rating' | 'date' | 'name';
    /** 排序方向 */
    sortOrder?: 'asc' | 'desc';
    /** 标签过滤 */
    tags?: string[];
}

/**
 * 搜索结果接口
 */
export interface SearchResult {
    /** 搜索结果列表 */
    items: SearchResultItem[];
    /** 总数量 */
    total: number;
    /** 当前页码 */
    page: number;
    /** 每页数量 */
    pageSize: number;
    /** 是否有更多数据 */
    hasMore: boolean;
    /** 搜索源 */
    source: SearchSource;
}

/**
 * 搜索提供者状态
 */
export interface SearchProviderStatus {
    /** 是否可用 */
    available: boolean;
    /** 是否需要认证 */
    requiresAuth: boolean;
    /** 是否已认证 */
    authenticated: boolean;
    /** 错误信息 */
    error?: string;
}
