/**
 * MintCat 后端 API 的源站、代理与服务路由约定（单处维护）。
 * 解析后的线路由设置页 / AppInitializer 写入 resolvedOrigin；未初始化前回退到语言启发式。
 */
import i18n from '@/locales/i18n';

type MintcatProxyPresetId = 'zh' | 'global';
type MintcatApiOriginPreset = {
    id: string;
    origin: string;
    labelKey: string;
    proxyPresetId: MintcatProxyPresetId;
};

/** 内置 API 节点（顺序即设置页展示顺序） */
export const MINTCAT_API_ORIGINS = [
    {
        id: 'zh',
        origin: 'https://api.v1st.net',
        labelKey: 'China Mainland Node',
        proxyPresetId: 'zh',
    },
    {
        id: 'global',
        origin: 'https://api.mintcat.work',
        labelKey: 'International Node',
        proxyPresetId: 'global',
    },
] as const satisfies readonly MintcatApiOriginPreset[];

export type MintcatApiOriginId = (typeof MINTCAT_API_ORIGINS)[number]['id'];

let resolvedOrigin: string | null = null;

const MINTCAT_PROXY_PATH = '/proxy';

export function setMintcatApiResolvedOrigin(origin: string | null): void {
    resolvedOrigin = origin ? normalizeMintcatApiOrigin(origin) : null;
}

export function getMintcatApiResolvedOrigin(): string | null {
    return resolvedOrigin;
}

/** 与历史行为一致：中文界面优先 v1st，否则 mintcat.work */
export function getMintcatApiOriginLanguageFallback(): string {
    return i18n.language?.startsWith('zh')
        ? getMintcatOriginByPresetId('zh')
        : getMintcatOriginByPresetId('global');
}

export function getMintcatApiOrigin(): string {
    if (resolvedOrigin) {
        return resolvedOrigin;
    }
    return getMintcatApiOriginLanguageFallback();
}

/**
 * 代理下载统一走固定 `/proxy` 路径：
 * - 大陆节点统一复用 `zh` 的 `/proxy`
 * - 国际节点复用 `global` 的 `/proxy`
 *
 * 其他非常规源站仍回退为当前源站下的 `/proxy`。
 */
export function getMintcatProxyOrigin(): string {
    const origin = normalizeMintcatApiOrigin(getMintcatApiOrigin());
    const preset = getMintcatOriginPresetByOrigin(origin);
    if (preset) {
        return mintcatApiUrl(getMintcatOriginByPresetId(preset.proxyPresetId), MINTCAT_PROXY_PATH);
    }

    return mintcatApiUrl(origin, MINTCAT_PROXY_PATH);
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

export function isMintcatApiOriginId(value: string): value is MintcatApiOriginId {
    return MINTCAT_API_ORIGINS.some((origin) => origin.id === value);
}

export function getMintcatOriginLabelKey(id: MintcatApiOriginId): string {
    return MINTCAT_API_ORIGINS.find((origin) => origin.id === id)?.labelKey ?? id;
}

/** 将 origin 与以 `/` 开头的 path（可含 query）拼接为完整 URL。 */
export function mintcatApiUrl(origin: string, pathnameAndQuery: string): string {
    const o = normalizeMintcatApiOrigin(origin);
    const p = pathnameAndQuery.startsWith('/') ? pathnameAndQuery : `/${pathnameAndQuery}`;
    return `${o}${p}`;
}

/**
 * MintCat 服务端 path 定义，按服务域分组，避免调用端只看到一个扁平常量表。
 */
export const MintCatApiPaths = {
    health: {
        ping: '/ping',
    },
    auth: {
        validateAccessToken: '/v1/validate-access-token',
    },
    cloudBackup: {
        list: '/v1/backups',
        byId: (backupId: string) => `/v1/backups/${backupId}`,
        download: (backupId: string) => `/v1/backups/${backupId}/download`,
    },
    releases: {
        checkUpdate: '/releases/check-update',
    },
} as const;

/**
 * MintCat 服务端 URL builder，按服务域输出可直接请求的完整 URL。
 * 这样调用端读起来更像“调用某个服务接口”，而不是“自己拼 path”。
 */
export const MintCatApiUrls = {
    health: {
        ping(origin: string = getMintcatApiOrigin()): string {
            return mintcatApiUrl(origin, MintCatApiPaths.health.ping);
        },
    },
    auth: {
        validateAccessToken(origin: string = getMintcatApiOrigin()): string {
            return mintcatApiUrl(origin, MintCatApiPaths.auth.validateAccessToken);
        },
    },
    cloudBackup: {
        list(origin: string = getMintcatApiOrigin()): string {
            return mintcatApiUrl(origin, MintCatApiPaths.cloudBackup.list);
        },
        byId(backupId: string, origin: string = getMintcatApiOrigin()): string {
            return mintcatApiUrl(origin, MintCatApiPaths.cloudBackup.byId(backupId));
        },
        download(backupId: string, origin: string = getMintcatApiOrigin()): string {
            return mintcatApiUrl(origin, MintCatApiPaths.cloudBackup.download(backupId));
        },
    },
    releases: {
        checkUpdate(origin: string = getMintcatApiOrigin()): string {
            return mintcatApiUrl(origin, MintCatApiPaths.releases.checkUpdate);
        },
        download(
            version: string,
            appType: string,
            platform: string,
            channel: string,
            origin: string = getMintcatApiOrigin(),
        ): string {
            const params = new URLSearchParams({ appType, platform, channel });
            return mintcatApiUrl(
                origin,
                `/releases/${encodeURIComponent(version)}/download?${params.toString()}`,
            );
        },
    },
} as const;

export function mintcatReleaseDownloadUrl(
    origin: string,
    version: string,
    appType: string,
    platform: string,
    channel: string,
): string {
    return MintCatApiUrls.releases.download(version, appType, platform, channel, origin);
}

function getMintcatOriginPresetByOrigin(origin: string) {
    const normalizedOrigin = normalizeMintcatApiOrigin(origin);
    return MINTCAT_API_ORIGINS.find((row) => normalizeMintcatApiOrigin(row.origin) === normalizedOrigin);
}

export function getMintcatOriginByPresetId(id: MintcatApiOriginId): string {
    const row = MINTCAT_API_ORIGINS.find((o) => o.id === id);
    const globalOrigin = MINTCAT_API_ORIGINS.find((o) => o.id === 'global')?.origin ?? MINTCAT_API_ORIGINS[0].origin;
    return row?.origin ?? globalOrigin;
}
