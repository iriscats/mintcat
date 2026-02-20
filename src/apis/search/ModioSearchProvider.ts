import {t} from 'i18next';
import {ISearchProvider} from './ISearchProvider';
import {
    SearchParams,
    SearchResult,
    SearchResultItem,
    SearchProviderStatus,
    SearchSource,
} from './types';
import {ModioApi} from '@/apis/modio';
import {ModInfo} from '@/apis/modio/ModInfo';

/**
 * Mod.io 搜索提供者实现
 */
export class ModioSearchProvider implements ISearchProvider {
    public readonly source = SearchSource.MODIO;
    public readonly displayName = 'mod.io';
    public readonly icon = 'https://mod.io/images/logo/modio-logo-bluedark.svg';

    /**
     * 检查 mod.io 服务状态
     */
    public async checkStatus(): Promise<SearchProviderStatus> {
        try {
            const isAvailable = await ModioApi.ping();
            return {
                available: isAvailable,
                requiresAuth: false,
                authenticated: true,
            };
        } catch (error) {
            return {
                available: false,
                requiresAuth: false,
                authenticated: false,
                error: String(error),
            };
        }
    }

    /**
     * 执行搜索
     */
    public async search(params: SearchParams): Promise<SearchResult> {
        const {query, page, pageSize, sortBy, sortOrder} = params;

        try {
            const modList = await ModioApi.getModList(page, pageSize, query || undefined, sortBy, sortOrder);
            const items = modList.map((mod) => this.mapModInfoToSearchResult(mod));

            return {
                items,
                total: items.length, // mod.io API 不返回总数，这里用当前数量
                page,
                pageSize,
                hasMore: items.length === pageSize,
                source: SearchSource.MODIO,
            };
        } catch (error) {
            console.error('ModioSearchProvider search error:', error);
            return {
                items: [],
                total: 0,
                page,
                pageSize,
                hasMore: false,
                source: SearchSource.MODIO,
            };
        }
    }

    /**
     * 获取搜索占位符
     */
    public getSearchPlaceholder(): string {
        return t('Search on mod.io');
    }

    /**
     * 将 ModInfo 转换为通用搜索结果格式
     */
    private mapModInfoToSearchResult(mod: ModInfo): SearchResultItem {
        return {
            id: `modio_${mod.id}`,
            platformId: mod.id,
            nameId: mod.name_id,
            name: mod.name,
            nameTrans: mod.name_trans,
            summary: mod.summary,
            summaryTrans: mod.summary_trans,
            profileUrl: mod.profile_url,
            thumbnailUrl: mod.logo?.thumb_320x180 || '',
            author: {
                id: mod.submitted_by?.id || 0,
                name: mod.submitted_by?.username || 'Unknown',
                avatarUrl: mod.submitted_by?.avatar?.thumb_50x50 || '',
            },
            stats: {
                downloads: mod.stats?.downloads_total || 0,
                subscribers: mod.stats?.subscribers_total || 0,
                rating: mod.stats?.ratings_percentage_positive,
            },
            tags: mod.tags?.map((tag) => tag.name) || [],
            source: SearchSource.MODIO,
            rawData: mod,
        };
    }
}

/**
 * 创建并获取 ModioSearchProvider 实例
 */
let modioProviderInstance: ModioSearchProvider | null = null;

export function getModioSearchProvider(): ModioSearchProvider {
    if (!modioProviderInstance) {
        modioProviderInstance = new ModioSearchProvider();
    }
    return modioProviderInstance;
}
