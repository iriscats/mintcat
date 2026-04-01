/**
 * MintCat 后端 API 的默认源站与路径约定（单处维护，避免各文件重复硬编码）。
 * 解析后的线路由设置页 / AppInitializer 写入 resolvedOrigin；未初始化前回退到语言启发式。
 */
import i18n from '@/locales/i18n';

/** 内置 API 节点（顺序：中国大陆、国际） */
export const MINTCAT_API_ORIGINS = [
    { id: 'zh' as const, origin: 'https://api.v1st.net' },
    { id: 'global' as const, origin: 'https://api.mintcat.work' },
] as const;

export type MintcatApiOriginId = (typeof MINTCAT_API_ORIGINS)[number]['id'];

let resolvedOrigin: string | null = null;

export function setMintcatApiResolvedOrigin(origin: string | null): void {
    resolvedOrigin = origin ? normalizeMintcatApiOrigin(origin) : null;
}

export function getMintcatApiResolvedOrigin(): string | null {
    return resolvedOrigin;
}

/** 与历史行为一致：中文界面优先 v1st，否则 mintcat.work */
export function getMintcatApiOriginLanguageFallback(): string {
    return i18n.language?.startsWith('zh') ? MINTCAT_API_ORIGINS[0].origin : MINTCAT_API_ORIGINS[1].origin;
}

export function getMintcatApiOrigin(): string {
    if (resolvedOrigin) {
        return resolvedOrigin;
    }
    return getMintcatApiOriginLanguageFallback();
}

/**
 * 代理下载域名与 API 节点保持同线路：
 * - `api.v1st.net` -> `proxy.v1st.net`
 * - `api.mintcat.work` -> `proxy.mintcat.work`
 *
 * 若将来出现非常规源站，则回退到历史的 `/proxy` 路径形式。
 */
export function getMintcatProxyOrigin(): string {
    const origin = getMintcatApiOrigin();

    try {
        const parsed = new URL(origin);
        if (parsed.hostname.startsWith('proxy.')) {
            parsed.pathname = '/';
            parsed.search = '';
            parsed.hash = '';
            return normalizeMintcatApiOrigin(parsed.toString());
        }
        if (parsed.hostname.startsWith('api.')) {
            parsed.hostname = `proxy.${parsed.hostname.slice('api.'.length)}`;
            parsed.pathname = '/';
            parsed.search = '';
            parsed.hash = '';
            return normalizeMintcatApiOrigin(parsed.toString());
        }
    } catch {
        // Ignore parse failure and fall back to the legacy `/proxy` form below.
    }

    return `${normalizeMintcatApiOrigin(origin)}/proxy`;
}

export function mintcatProxyUrl(targetUrl: string, proxyOrigin: string = getMintcatProxyOrigin()): string {
    const proxyBase = normalizeMintcatApiOrigin(proxyOrigin);
    const normalizedTargetUrl = targetUrl.trim().replace(/^\/+/, '');
    return `${proxyBase}/${normalizedTargetUrl}`;
}

export function isMintcatProxyUrl(url: string, proxyOrigin: string = getMintcatProxyOrigin()): boolean {
    return url.startsWith(`${normalizeMintcatApiOrigin(proxyOrigin)}/`);
}

export function normalizeMintcatApiOrigin(url: string): string {
    return url.trim().replace(/\/+$/, '');
}

/** 将 origin 与以 `/` 开头的 path（可含 query）拼接为完整 URL。 */
export function mintcatApiUrl(origin: string, pathnameAndQuery: string): string {
    const o = normalizeMintcatApiOrigin(origin);
    const p = pathnameAndQuery.startsWith('/') ? pathnameAndQuery : `/${pathnameAndQuery}`;
    return `${o}${p}`;
}

export const MintCatApiPaths = {
    ping: '/ping',
    validateAccessToken: '/v1/validate-access-token',
    backups: '/v1/backups',
    backupDownload: (backupId: string) => `/v1/backups/${backupId}/download`,
    backupById: (backupId: string) => `/v1/backups/${backupId}`,
    releasesCheckUpdate: '/releases/check-update',
} as const;

export function mintcatReleaseDownloadUrl(
    origin: string,
    version: string,
    appType: string,
    platform: string,
    channel: string,
): string {
    const params = new URLSearchParams({ appType, platform, channel });
    const o = normalizeMintcatApiOrigin(origin);
    return `${o}/releases/${encodeURIComponent(version)}/download?${params.toString()}`;
}

export function getMintcatOriginByPresetId(id: MintcatApiOriginId): string {
    const row = MINTCAT_API_ORIGINS.find((o) => o.id === id);
    return row?.origin ?? MINTCAT_API_ORIGINS[1].origin;
}
