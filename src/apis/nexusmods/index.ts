import { message } from 'antd';
import { t } from 'i18next';
import { CacheApi } from '@/apis/CacheApi';
import { DownloadApi } from '@/apis/DownloadApi';
import { IntegrateApi } from '@/apis/IntegrateApi';
import { NetworkApi } from '@/apis/NetworkApi';
import { StorageAPI } from '@/storage';
import { AuthResolver } from '@/services/network';
import type { CompleteModData } from '@/storage/dao/ModDAO';
import {
    NEXUSMODS_DRG_DOMAIN,
    NEXUSMODS_PLATFORM,
    type NexusModsDownloadLink,
    type NexusModsFile,
    type NexusModsFilesResponse,
    type NexusModsModNode,
    type NexusModsParsedUrl,
    type NexusModsResolvedMod,
    type NexusModsSearchParams,
    type NexusModsSearchResult,
    type NexusModsV1Mod,
} from './types';

export {
    NEXUSMODS_DRG_DOMAIN,
    NEXUSMODS_PLATFORM,
    NEXUSMODS_ROGUE_CORE_DOMAIN,
    NEXUSMODS_ROGUE_CORE_GAME_URL,
} from './types';
export { showNexusModsApiKeyRequiredMessage } from './authPrompt';
export type {
    NexusModsDownloadLink,
    NexusModsFile,
    NexusModsModNode,
    NexusModsParsedUrl,
    NexusModsResolvedMod,
    NexusModsSearchParams,
    NexusModsSearchResult,
    NexusModsV1Mod,
} from './types';

const NEXUSMODS_API_BASE_URL = 'https://api.nexusmods.com';
const NEXUSMODS_GRAPHQL_URL = `${NEXUSMODS_API_BASE_URL}/v2/graphql`;
const NEXUSMODS_APP_NAME = 'MintCat';
const NEXUSMODS_APP_VERSION = '0.5.5';

const authResolver = new AuthResolver();

type GraphqlResponse<T> = {
    data?: T;
    errors?: Array<{ message?: string }>;
};

type NexusModsGraphqlModsResponse = {
    mods?: {
        nodes?: NexusModsModNode[];
        totalCount?: number;
        nodesCount?: number;
    };
};

export class NexusModsDownloadRequiresVisitError extends Error {
    public readonly fallbackUrl: string;

    constructor(fallbackUrl: string, message = 'nexusmods.downloadRequiresVisit') {
        super(message);
        this.name = 'NexusModsDownloadRequiresVisitError';
        this.fallbackUrl = fallbackUrl;
    }
}

export class NexusModsAuthenticationRequiredError extends Error {
    constructor(message = 'nexusmods.apiKeyRequired') {
        super(message);
        this.name = 'NexusModsAuthenticationRequiredError';
    }
}

export class NexusModsApi {
    public static async getApiKey(): Promise<string> {
        return await authResolver.getNexusmodsToken();
    }

    public static async isAuthenticated(): Promise<boolean> {
        return !!(await NexusModsApi.getApiKey());
    }

    public static getModUrl(domain: string, modId: number): string {
        return `https://www.nexusmods.com/${domain}/mods/${modId}`;
    }

    public static getModFilesUrl(domain: string, modId: number): string {
        return `${NexusModsApi.getModUrl(domain, modId)}?tab=files`;
    }

    public static parseModLinks(link: string): NexusModsParsedUrl | undefined {
        const value = link?.trim();
        if (!value) return undefined;

        try {
            const parsed = new URL(value);
            const protocol = parsed.protocol.toLowerCase();
            const hostname = parsed.hostname.toLowerCase();

            if ((protocol === 'http:' || protocol === 'https:') && (hostname === 'www.nexusmods.com' || hostname === 'nexusmods.com')) {
                const parts = parsed.pathname.split('/').filter(Boolean);
                const gameOffset = parts[0]?.toLowerCase() === 'games' ? 1 : 0;
                const domain = parts[gameOffset]?.toLowerCase();
                const modsSegment = parts[gameOffset + 1]?.toLowerCase();
                const modId = Number(parts[gameOffset + 2]);
                const fileIdFromPath = parts[gameOffset + 3]?.toLowerCase() === 'files'
                    ? Number(parts[gameOffset + 4])
                    : undefined;
                const fileIdFromQuery = Number(parsed.searchParams.get('file_id') || 0) || undefined;
                if (domain && modsSegment === 'mods' && Number.isFinite(modId) && modId > 0) {
                    return {
                        domain,
                        modId,
                        fileId: fileIdFromPath || fileIdFromQuery,
                        rawUrl: value,
                    };
                }
            }

            if ((protocol === 'http:' || protocol === 'https:') && hostname.endsWith('nexus-cdn.com')) {
                const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
                const domain = hash.get('mintcat_domain')?.toLowerCase() || '';
                const modId = Number(hash.get('mintcat_mod_id') || 0);
                const fileId = Number(hash.get('mintcat_file_id') || 0) || undefined;
                if (domain && Number.isFinite(modId) && modId > 0) {
                    return {
                        domain,
                        modId,
                        fileId,
                        expires: Number(parsed.searchParams.get('expires') || 0) || undefined,
                        userId: Number(parsed.searchParams.get('user_id') || 0) || undefined,
                        rawUrl: value,
                        directDownloadUrl: NexusModsApi.stripUrlFragment(value),
                    };
                }
            }

            if (protocol === 'nxm:') {
                const parts = parsed.pathname.split('/').filter(Boolean);
                const modId = Number(parts[1]);
                const fileId = Number(parts[3]);
                if (parts[0]?.toLowerCase() === 'mods' && parts[2]?.toLowerCase() === 'files' && Number.isFinite(modId) && Number.isFinite(fileId)) {
                    return {
                        domain: parsed.hostname.toLowerCase(),
                        modId,
                        fileId,
                        key: parsed.searchParams.get('key') || undefined,
                        expires: Number(parsed.searchParams.get('expires') || 0) || undefined,
                        userId: Number(parsed.searchParams.get('user_id') || 0) || undefined,
                        rawUrl: value,
                    };
                }
            }
        } catch {
            // Fall through to invalid link.
        }

        return undefined;
    }

    public static isNexusModsLink(link: string): boolean {
        return !!NexusModsApi.parseModLinks(link);
    }

    public static hasReusableDownloadCredential(link: string | undefined): boolean {
        const parsed = NexusModsApi.parseModLinks(link || '');
        if (!parsed) return false;
        if (parsed.expires && parsed.expires <= Math.floor(Date.now() / 1000)) return false;
        return !!parsed.key || !!parsed.directDownloadUrl;
    }

    public static isAuthenticationRequiredError(error: unknown): boolean {
        if (error instanceof NexusModsAuthenticationRequiredError) {
            return true;
        }
        const message = error instanceof Error ? error.message : String(error);
        return message.includes('Nexus Mods API 401')
            || message.includes('Please provide an authentication method');
    }

    public static async checkStatus(): Promise<boolean> {
        const apiKey = await NexusModsApi.getApiKey();
        if (!apiKey) return false;

        try {
            const resp = await NexusModsApi.requestJson<Response>('/v1/users/validate.json', {
                parseAsResponse: true,
            });
            return resp.ok;
        } catch (error) {
            console.warn('[NexusModsApi] validate failed:', error);
            return false;
        }
    }

    public static async searchMods(params: NexusModsSearchParams): Promise<NexusModsSearchResult> {
        const domain = params.domain || NEXUSMODS_DRG_DOMAIN;
        const filterClauses: unknown[] = [
            { gameDomainName: [{ value: domain, op: 'EQUALS' }] },
        ];

        const normalizedQuery = params.query?.trim();
        if (normalizedQuery) {
            filterClauses.push(NexusModsApi.buildSearchQueryFilter(normalizedQuery));
        }

        const query = `
            query NexusModsSearch($filter: ModsFilter, $sort: [ModsSort!], $offset: Int, $count: Int) {
                mods(filter: $filter, sort: $sort, offset: $offset, count: $count) {
                    nodes {
                        id
                        uid
                        modId
                        gameId
                        name
                        summary
                        description
                        author
                        downloads
                        endorsements
                        version
                        fileSize
                        pictureUrl
                        thumbnailUrl
                        thumbnailLargeUrl
                        createdAt
                        updatedAt
                        game {
                            id
                            domainName
                            name
                        }
                        uploader {
                            name
                            avatar
                        }
                    }
                    totalCount
                    nodesCount
                }
            }
        `;

        const sort = NexusModsApi.buildSearchSort(params.sortBy, params.sortOrder, !!normalizedQuery);
        const requestPageSize = normalizedQuery ? Math.max(params.pageSize * 4, 100) : params.pageSize;
        if (normalizedQuery) {
            const maxQueryPages = 5;
            const collectedNodes: NexusModsModNode[] = [];
            let remoteTotal = 0;

            for (let page = 0; page < maxQueryPages; page++) {
                const data = await NexusModsApi.graphql<NexusModsGraphqlModsResponse>(query, {
                    filter: { op: 'AND', filter: filterClauses },
                    sort,
                    offset: page * requestPageSize,
                    count: requestPageSize,
                });
                const nodes = data.mods?.nodes ?? [];
                remoteTotal = data.mods?.totalCount ?? collectedNodes.length + nodes.length;
                collectedNodes.push(...nodes);
                if (nodes.length === 0 || collectedNodes.length >= remoteTotal) {
                    break;
                }
            }

            const filteredNodes = NexusModsApi.filterSearchNodes(collectedNodes, normalizedQuery);
            const start = params.page * params.pageSize;
            const end = start + params.pageSize;
            return {
                items: filteredNodes.slice(start, end),
                total: filteredNodes.length,
                page: params.page,
                pageSize: params.pageSize,
                hasMore: end < filteredNodes.length || collectedNodes.length < remoteTotal,
            };
        }

        const data = await NexusModsApi.graphql<NexusModsGraphqlModsResponse>(query, {
            filter: { op: 'AND', filter: filterClauses },
            sort,
            offset: params.page * params.pageSize,
            count: requestPageSize,
        });

        const items = data.mods?.nodes ?? [];
        const total = data.mods?.totalCount ?? items.length;
        return {
            items,
            total,
            page: params.page,
            pageSize: params.pageSize,
            hasMore: (params.page + 1) * params.pageSize < total,
        };
    }

    public static async getModInfo(domain: string, modId: number): Promise<NexusModsV1Mod> {
        return await NexusModsApi.requestJson<NexusModsV1Mod>(`/v1/games/${domain}/mods/${modId}.json`);
    }

    public static async getModFiles(domain: string, modId: number): Promise<NexusModsFile[]> {
        const data = await NexusModsApi.requestJson<NexusModsFilesResponse | NexusModsFile[]>(
            `/v1/games/${domain}/mods/${modId}/files.json`,
        );
        if (Array.isArray(data)) return data;
        return data.files ?? [];
    }

    public static pickDownloadableFile(files: NexusModsFile[], preferredFileId?: number): NexusModsFile | undefined {
        if (preferredFileId) {
            const matched = files.find((file) => NexusModsApi.getFileId(file) === preferredFileId);
            if (matched) return matched;
        }

        const downloadable = files.filter((file) => {
            const categoryName = file.category_name?.toLowerCase() ?? '';
            return !['old_version', 'old versions', 'archived', 'removed'].includes(categoryName);
        });

        return downloadable.find((file) => file.is_primary)
            ?? downloadable.find((file) => file.category_id === 1 || file.category_name?.toLowerCase() === 'main')
            ?? downloadable.sort((a, b) => (b.uploaded_timestamp ?? 0) - (a.uploaded_timestamp ?? 0))[0]
            ?? files[0];
    }

    public static async getDownloadLinks(
        domain: string,
        modId: number,
        fileId: number,
        credentials?: Pick<NexusModsParsedUrl, 'key' | 'expires'>,
    ): Promise<NexusModsDownloadLink[]> {
        try {
            const params = new URLSearchParams();
            if (credentials?.key) params.set('key', credentials.key);
            if (credentials?.expires) params.set('expires', String(credentials.expires));
            const query = params.toString();
            const path = `/v1/games/${domain}/mods/${modId}/files/${fileId}/download_link.json${query ? `?${query}` : ''}`;
            const data = await NexusModsApi.requestJson<NexusModsDownloadLink[]>(path);
            return Array.isArray(data) ? data : [];
        } catch (error) {
            throw NexusModsApi.toVisitError(error, NexusModsApi.getModFilesUrl(domain, modId));
        }
    }

    public static async getModInfoByLink(url: string): Promise<NexusModsResolvedMod | null> {
        const parsed = NexusModsApi.parseModLinks(url);
        if (!parsed) {
            message.error(`${t('Invalid Mod Link')}: ${NexusModsApi.sanitizeDownloadUrlForLog(url)}`);
            return null;
        }

        const mod = await NexusModsApi.getModInfo(parsed.domain, parsed.modId);
        const files = await NexusModsApi.getModFiles(parsed.domain, parsed.modId);
        const file = NexusModsApi.pickDownloadableFile(files, parsed.fileId);
        return {
            domain: parsed.domain,
            modId: parsed.modId,
            mod,
            file,
            sourceUrl: url,
        };
    }

    public static async refreshResolvedMod(mod: CompleteModData): Promise<NexusModsResolvedMod | null> {
        const parsed = NexusModsApi.parseModLinks(mod.url || '');
        if (!parsed) return null;
        return await NexusModsApi.getModInfoByLink(NexusModsApi.getModUrl(parsed.domain, parsed.modId));
    }

    public static async downloadModFile(
        modInfo: CompleteModData,
        onProgress?: (loaded: number, total: number) => void,
    ): Promise<CompleteModData> {
        const credentialParsed = NexusModsApi.parseModLinks(modInfo.download?.downloadUrl || '');
        const canonicalParsed = NexusModsApi.parseModLinks(modInfo.url || '');
        const parsed = credentialParsed?.key || credentialParsed?.directDownloadUrl || credentialParsed?.fileId
            ? credentialParsed
            : canonicalParsed;
        if (!parsed) {
            throw new Error(`${t('Invalid Mod Link')}: ${modInfo.url || modInfo.displayName}`);
        }
        if (parsed.expires && parsed.expires <= Math.floor(Date.now() / 1000)) {
            throw new NexusModsDownloadRequiresVisitError(
                NexusModsApi.getModFilesUrl(parsed.domain, parsed.modId),
                'nexusmods.downloadLinkExpired',
            );
        }

        const files = await NexusModsApi.getModFiles(parsed.domain, parsed.modId);
        const file = NexusModsApi.pickDownloadableFileForMod(modInfo, files, parsed.fileId);
        const fileId = file ? NexusModsApi.getFileId(file) : 0;
        if (!fileId) {
            throw new Error(t('mod.noDownloadableVersion') || 'mod.noDownloadableVersion');
        }

        const fileName = `nexusmods-${parsed.domain}-${parsed.modId}-${fileId}-${modInfo.nameId || modInfo.displayName}`;
        const version = file?.version || modInfo.version?.currentVersion || 'latest';
        const fileSize = NexusModsApi.getFileSizeBytes(file) || modInfo.download?.fileSize || 0;

        if (fileSize > 0 && await CacheApi.checkCacheFile(fileName, version, fileSize)) {
            const cachePath = await CacheApi.getModCachePath(fileName, version);
            onProgress?.(fileSize, fileSize);
            return {
                ...modInfo,
                download: { ...modInfo.download!, cachePath, fileSize, downloadProgress: 100 },
            };
        }

        const links = parsed.directDownloadUrl
            ? []
            : await NexusModsApi.getDownloadLinks(parsed.domain, parsed.modId, fileId, parsed);
        const downloadUrl = parsed.directDownloadUrl || NexusModsApi.pickDownloadUrl(links);
        if (!downloadUrl) {
            throw new NexusModsDownloadRequiresVisitError(NexusModsApi.getModFilesUrl(parsed.domain, parsed.modId));
        }

        const cachePath = await CacheApi.getModCachePath(fileName, version);
        await DownloadApi.downloadFile(
            downloadUrl,
            cachePath,
            { resume: true, retryCount: 3, timeoutSecs: 900 },
            (downloaded, total) => onProgress?.(downloaded, total || fileSize),
        );

        if (!await IntegrateApi.validateZipFile(cachePath)) {
            const { remove } = await import('@tauri-apps/plugin-fs');
            try { await remove(cachePath); } catch (_) { /* best effort */ }
            throw new Error(`${t('Downloaded file is corrupted')}: ${modInfo.displayName}`);
        }

        onProgress?.(fileSize, fileSize);
        return {
            ...modInfo,
            download: {
                ...modInfo.download!,
                cachePath,
                downloadUrl,
                fileSize,
                downloadProgress: 100,
                downloadStatus: 'completed',
            },
        };
    }

    public static getFileId(file: NexusModsFile | undefined): number {
        return file?.file_id ?? file?.id ?? 0;
    }

    public static getFileSizeBytes(file: NexusModsFile | undefined): number {
        const raw = file?.size ?? file?.size_kb ?? 0;
        if (!raw) return 0;
        return raw > 0 && raw < 1024 * 1024 ? raw * 1024 : raw;
    }

    private static pickDownloadableFileForMod(
        modInfo: CompleteModData,
        files: NexusModsFile[],
        preferredFileId?: number,
    ): NexusModsFile | undefined {
        if (preferredFileId) {
            return NexusModsApi.pickDownloadableFile(files, preferredFileId);
        }

        const selectedVersion = modInfo.version?.currentVersion;
        if (selectedVersion && selectedVersion !== '-') {
            const matched = NexusModsApi.findFileByVersion(files, selectedVersion);
            if (matched) return matched;
        }

        return NexusModsApi.pickDownloadableFile(files);
    }

    private static findFileByVersion(files: NexusModsFile[], version: string): NexusModsFile | undefined {
        const target = NexusModsApi.normalizeVersionLabel(version);
        if (!target) return undefined;

        return files.find((file) => {
            const labels = [
                file.version,
                file.name,
                file.file_name,
            ].map(NexusModsApi.normalizeVersionLabel);
            return labels.includes(target);
        });
    }

    private static normalizeVersionLabel(value: string | undefined): string {
        return (value || '')
            .trim()
            .toLowerCase()
            .replace(/^v(?=\d)/, '');
    }

    public static normalizeImageUrl(url: string | undefined): string {
        const value = url?.trim() ?? '';
        if (!value) return '';
        if (value.startsWith('//')) return `https:${value}`;
        if (value.startsWith('/')) return `https://www.nexusmods.com${value}`;
        return value;
    }

    private static async graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
        const response = await NexusModsApi.requestJson<GraphqlResponse<T>>(NEXUSMODS_GRAPHQL_URL, {
            method: 'POST',
            body: JSON.stringify({ query, variables }),
            isFullUrl: true,
        });
        if (response.errors?.length) {
            const errorMessage = response.errors.map((error) => error.message).filter(Boolean).join('; ') || 'Nexus Mods GraphQL error';
            console.warn('[NexusModsApi] GraphQL errors:', errorMessage);
            throw new Error(errorMessage);
        }
        return response.data ?? ({} as T);
    }

    private static async requestJson<T>(
        pathOrUrl: string,
        options: {
            method?: string;
            body?: string;
            isFullUrl?: boolean;
            parseAsResponse?: boolean;
        } = {},
    ): Promise<T> {
        const headers = await NexusModsApi.getHeaders();
        const url = options.isFullUrl ? pathOrUrl : `${NEXUSMODS_API_BASE_URL}${pathOrUrl}`;
        const result = await NetworkApi.request<Response>({
            service: 'nexusmods.request',
            url,
            method: options.method ?? 'GET',
            headers,
            body: options.body,
            proxyPolicy: 'mintcatProxyFallback',
            parseAs: 'response',
        });

        const response = result.response;
        if (options.parseAsResponse) {
            return response as T;
        }
        if (!response.ok) {
            const message = await response.text().catch(() => '');
            if (response.status === 401) {
                throw new NexusModsAuthenticationRequiredError(message || response.statusText);
            }
            throw new Error(`Nexus Mods API ${response.status}: ${message || response.statusText}`);
        }
        return await response.json() as T;
    }

    private static async getHeaders(): Promise<Record<string, string>> {
        const apiKey = await NexusModsApi.getApiKey();
        const headers: Record<string, string> = {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'Application-Name': NEXUSMODS_APP_NAME,
            'Application-Version': NEXUSMODS_APP_VERSION,
        };
        if (apiKey) {
            headers.apikey = apiKey;
        }
        return headers;
    }

    private static buildSearchSort(
        sortBy: NexusModsSearchParams['sortBy'],
        sortOrder: NexusModsSearchParams['sortOrder'],
        hasQuery: boolean,
    ): unknown[] {
        const direction = (sortOrder === 'asc' ? 'ASC' : 'DESC');
        if (hasQuery && (!sortBy || sortBy === 'rating')) {
            return [{ relevance: { direction: 'DESC' } }];
        }
        switch (sortBy) {
            case 'name':
                return [{ name: { direction } }];
            case 'downloads':
            case 'subscribers':
                return [{ downloads: { direction } }];
            case 'rating':
                return [{ endorsements: { direction } }];
            case 'date':
            default:
                return [{ updatedAt: { direction } }];
        }
    }

    private static buildSearchQueryFilter(query: string): unknown {
        const wildcardQuery = `*${query}*`;
        return {
            op: 'OR',
            filter: [
                { nameStemmed: [{ value: query, op: 'MATCHES' }] },
                { name: [{ value: wildcardQuery, op: 'WILDCARD' }] },
                { description: [{ value: query, op: 'MATCHES' }] },
                { author: [{ value: query, op: 'MATCHES' }] },
                { uploader: [{ value: query, op: 'MATCHES' }] },
            ],
        };
    }

    private static filterSearchNodes(nodes: NexusModsModNode[], query: string | undefined): NexusModsModNode[] {
        const normalizedQuery = query?.trim().toLowerCase();
        if (!normalizedQuery) return nodes;

        const terms = normalizedQuery.split(/\s+/).filter(Boolean);
        if (terms.length === 0) return nodes;

        return nodes.filter((mod) => {
            const haystack = [
                mod.name,
                mod.summary,
                mod.description,
                mod.author,
                mod.uploader?.name,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return terms.every((term) => haystack.includes(term));
        });
    }

    private static pickDownloadUrl(links: NexusModsDownloadLink[]): string {
        return links.find((link) => link.URI || link.uri)?.URI
            ?? links.find((link) => link.URI || link.uri)?.uri
            ?? '';
    }

    private static stripUrlFragment(url: string): string {
        try {
            const parsed = new URL(url);
            parsed.hash = '';
            return parsed.toString();
        } catch {
            return url.replace(/#.*$/, '');
        }
    }

    private static sanitizeDownloadUrlForLog(url: string): string {
        try {
            const parsed = new URL(url);
            for (const key of ['key', 'expires', 'user_id', 'md5']) {
                if (parsed.searchParams.has(key)) {
                    parsed.searchParams.set(key, '[REDACTED]');
                }
            }
            return parsed.toString();
        } catch {
            return url.replace(/([?&](?:key|expires|user_id|md5)=)[^&#\s]+/gi, '$1[REDACTED]');
        }
    }

    private static toVisitError(error: unknown, fallbackUrl: string): Error {
        const message = error instanceof Error ? error.message : String(error);
        if (
            message.includes(' 401:') ||
            message.includes(' 403:') ||
            message.includes('premium') ||
            message.includes("don't have permission")
        ) {
            return new NexusModsDownloadRequiresVisitError(fallbackUrl, message);
        }
        return error instanceof Error ? error : new Error(message);
    }
}
