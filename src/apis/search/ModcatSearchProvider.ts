/**
 * ModCat 搜索提供者实现
 * 
 * 提供 modcat.top 网站的 mod 搜索功能
 */

import { t } from 'i18next';
import { ISearchProvider } from './ISearchProvider';
import {
    SearchParams,
    SearchResult,
    SearchResultItem,
    SearchProviderStatus,
    SearchSource,
} from './types';
import { ModcatApi } from '@/apis/modcat';
import type { ModcatModListViewEntity, ModcatModEntity } from '@/apis/modcat/types';

/**
 * ModCat 搜索提供者实现
 */
export class ModcatSearchProvider implements ISearchProvider {
    public readonly source = SearchSource.MODCAT;
    public readonly displayName = 'ModCat';
    public readonly icon = 'https://modcat.top/favicon.ico';

    /**
     * 检查 ModCat 服务状态
     */
    public async checkStatus(): Promise<SearchProviderStatus> {
        try {
            const isAvailable = await ModcatApi.ping();
            const isAuthenticated = await ModcatApi.isAuthenticated();
            
            return {
                available: isAvailable,
                requiresAuth: false, // 搜索不需要认证
                authenticated: isAuthenticated,
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
        const { query, page, pageSize } = params;

        try {
            const modList = await ModcatApi.getModList(page, pageSize, query || undefined);
            const items = modList.map((mod) => this.mapModToSearchResult(mod));

            return {
                items,
                total: items.length,
                page,
                pageSize,
                hasMore: items.length === pageSize,
                source: SearchSource.MODCAT,
            };
        } catch (error) {
            console.error('ModcatSearchProvider search error:', error);
            return {
                items: [],
                total: 0,
                page,
                pageSize,
                hasMore: false,
                source: SearchSource.MODCAT,
            };
        }
    }

    /**
     * 获取搜索占位符
     */
    public getSearchPlaceholder(): string {
        return t('Search on ModCat') || 'Search on ModCat';
    }

    /**
     * 将 ModcatModListViewEntity 转换为通用搜索结果格式
     */
    private mapModToSearchResult(mod: ModcatModListViewEntity): SearchResultItem {
        return {
            id: `modcat_${mod.ModId}`,
            platformId: undefined, // modcat 使用字符串 ID
            nameId: mod.ModId || '',
            name: mod.Name || '',
            nameTrans: undefined,
            summary: '', // ListView 不包含描述
            summaryTrans: undefined,
            profileUrl: `https://modcat.top/mod/${mod.ModId}`,
            thumbnailUrl: mod.PicUrl || '',
            author: {
                id: 0,
                name: 'Unknown', // ListView 不包含作者信息
                avatarUrl: '',
            },
            stats: {
                downloads: 0, // ListView 不包含下载数
                subscribers: 0,
                rating: mod.AVGPoint ? mod.AVGPoint * 20 : undefined, // 转换为百分比
            },
            tags: mod.ModTypeEntities?.map((t) => t.TypeName).filter(Boolean) as string[] || [],
            source: SearchSource.MODCAT,
            rawData: mod,
        };
    }

    /**
     * 将完整的 ModcatModEntity 转换为搜索结果格式
     */
    public mapFullModToSearchResult(mod: ModcatModEntity): SearchResultItem {
        return {
            id: `modcat_${mod.ModId}`,
            platformId: undefined,
            nameId: mod.ModId || '',
            name: mod.Name || '',
            nameTrans: undefined,
            summary: mod.Description || '',
            summaryTrans: undefined,
            profileUrl: `https://modcat.top/mod/${mod.ModId}`,
            thumbnailUrl: mod.PicUrl || '',
            author: {
                id: 0,
                name: mod.CreatorEntity?.NickName || 'Unknown',
                avatarUrl: mod.CreatorEntity?.HeadPic || '',
            },
            stats: {
                downloads: mod.DownloadCount || 0,
                subscribers: 0,
                rating: mod.AVGPoint ? mod.AVGPoint * 20 : undefined,
            },
            tags: mod.ModTypeEntities?.map((t) => t.Types?.TypeName).filter(Boolean) as string[] || [],
            source: SearchSource.MODCAT,
            rawData: mod,
        };
    }
}

/**
 * ModcatSearchProvider 单例
 */
let modcatProviderInstance: ModcatSearchProvider | null = null;

/**
 * 获取 ModcatSearchProvider 实例
 */
export function getModcatSearchProvider(): ModcatSearchProvider {
    if (!modcatProviderInstance) {
        modcatProviderInstance = new ModcatSearchProvider();
    }
    return modcatProviderInstance;
}
