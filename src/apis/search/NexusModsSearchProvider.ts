import { t } from 'i18next';
import { message } from 'antd';
import { ISearchProvider } from './ISearchProvider';
import {
    SearchParams,
    SearchProviderStatus,
    SearchResult,
    SearchResultItem,
    SearchSource,
} from './types';
import {
    NEXUSMODS_DRG_DOMAIN,
    NexusModsApi,
    showNexusModsApiKeyRequiredMessage,
    type NexusModsModNode,
} from '@/apis/nexusmods';

export class NexusModsSearchProvider implements ISearchProvider {
    public readonly source = SearchSource.NEXUSMODS;
    public readonly displayName = 'Nexus Mods';
    public readonly icon = 'https://www.nexusmods.com/favicon.ico';

    public async checkStatus(): Promise<SearchProviderStatus> {
        const authenticated = await NexusModsApi.isAuthenticated();
        if (!authenticated) {
            return {
                available: false,
                requiresAuth: true,
                authenticated: false,
                error: 'Nexus Mods API key required',
            };
        }

        const available = await NexusModsApi.checkStatus();
        return {
            available,
            requiresAuth: true,
            authenticated: available,
            error: available ? undefined : 'Nexus Mods API unavailable',
        };
    }

    public async search(params: SearchParams): Promise<SearchResult> {
        const { query, page, pageSize, sortBy, sortOrder, nexusmodsGameDomain } = params;
        try {
            if (!await NexusModsApi.isAuthenticated()) {
                showNexusModsApiKeyRequiredMessage();
                return this.emptyResult(page, pageSize);
            }

            const result = await NexusModsApi.searchMods({
                query,
                page,
                pageSize,
                sortBy,
                sortOrder,
                domain: nexusmodsGameDomain || NEXUSMODS_DRG_DOMAIN,
            });

            return {
                items: result.items.map((mod) => this.mapModToSearchResult(mod)),
                total: result.total,
                page,
                pageSize,
                hasMore: result.hasMore,
                source: SearchSource.NEXUSMODS,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('NexusModsSearchProvider search error:', errorMessage);
            message.error(t('nexusmods.searchFailed'));
            return this.emptyResult(page, pageSize);
        }
    }

    public getSearchPlaceholder(): string {
        return t('Search on Nexus Mods');
    }

    private mapModToSearchResult(mod: NexusModsModNode): SearchResultItem {
        const domain = mod.game?.domainName || NEXUSMODS_DRG_DOMAIN;
        const modId = mod.modId || Number(mod.id) || 0;
        const authorName = mod.author || mod.uploader?.name || 'Unknown';

        return {
            id: `nexusmods_${domain}_${modId}`,
            platformId: modId,
            nameId: String(modId),
            name: mod.name || '',
            summary: mod.summary || '',
            profileUrl: NexusModsApi.getModUrl(domain, modId),
            thumbnailUrl: NexusModsApi.normalizeImageUrl(mod.thumbnailLargeUrl || mod.thumbnailUrl || mod.pictureUrl),
            author: {
                id: 0,
                name: authorName,
                avatarUrl: NexusModsApi.normalizeImageUrl(mod.uploader?.avatar),
            },
            stats: {
                downloads: mod.downloads || 0,
                subscribers: 0,
                rating: mod.endorsements ? Math.min(100, mod.endorsements) : undefined,
            },
            tags: [],
            source: SearchSource.NEXUSMODS,
            rawData: mod,
        };
    }

    private emptyResult(page: number, pageSize: number): SearchResult {
        return {
            items: [],
            total: 0,
            page,
            pageSize,
            hasMore: false,
            source: SearchSource.NEXUSMODS,
        };
    }
}

let nexusModsProviderInstance: NexusModsSearchProvider | null = null;

export function getNexusModsSearchProvider(): NexusModsSearchProvider {
    if (!nexusModsProviderInstance) {
        nexusModsProviderInstance = new NexusModsSearchProvider();
    }
    return nexusModsProviderInstance;
}
