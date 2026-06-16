/**
 * MintCat 发布与更新检查：从静态 manifest（update.json）拉取各组件版本信息，
 * 解析下载地址、比对 semver 风格版本号，并批量返回是否有更新及下载元数据。
 * 实际网络请求通过 Tauri `fetch_update_manifest` 在 Rust 侧完成。
 */
import type { UpdateCheckItem, UpdateCheckManifestItem, UpdateCheckResult } from './types';
import { invoke } from '@tauri-apps/api/core';
import i18n from '@/locales/i18n';
import { DEFAULT_RELEASE_CHANNEL } from './releaseChannel';
import {
    compareVersion,
    getManifestItemChecksum,
    getManifestItemDownloadPath,
    matchesRequestedUpdateItem,
    normalizeManifestKey,
} from './releaseUtils';

// ---------------------------------------------------------------------------
// Release 资源源站
// ---------------------------------------------------------------------------

type MintcatReleaseOriginPreset = {
    id: string;
    manifestUrl: string;
    labelKey: string;
};

/** 杭州 OSS 上的 update.json（大陆节点） */
export const MINTCAT_UPDATE_MANIFEST_URL_HZ = 'https://yuri-oss-hz.oss-cn-hangzhou.aliyuncs.com/update.json';

/** @deprecated Use MINTCAT_UPDATE_MANIFEST_URL_HZ. */
export const MINTCAT_UPDATE_MANIFEST_URL = MINTCAT_UPDATE_MANIFEST_URL_HZ;

/** 新加坡 OSS 上的 update.json（国际节点，含英文） */
export const MINTCAT_UPDATE_MANIFEST_URL_SG = 'https://yuri-oss-sg.oss-ap-southeast-1.aliyuncs.com/update.json';

/** release/update.json 与相对下载资源的节点列表（顺序即设置页展示顺序） */
export const MINTCAT_RELEASE_ORIGINS = [
    {
        id: 'mainland',
        manifestUrl: MINTCAT_UPDATE_MANIFEST_URL_HZ,
        labelKey: 'China Mainland Node',
    },
    {
        id: 'global',
        manifestUrl: MINTCAT_UPDATE_MANIFEST_URL_SG,
        labelKey: 'International Node',
    },
] as const satisfies readonly MintcatReleaseOriginPreset[];

export type MintcatReleaseOriginId = (typeof MINTCAT_RELEASE_ORIGINS)[number]['id'];

let resolvedUpdateManifestUrl: string | null = null;

// ---------------------------------------------------------------------------
// 运行时 release 源站解析
// ---------------------------------------------------------------------------

export function isMintcatReleaseOriginId(value: string): value is MintcatReleaseOriginId {
    return MINTCAT_RELEASE_ORIGINS.some((origin) => origin.id === value);
}

export function getMintcatReleaseOriginLabelKey(id: MintcatReleaseOriginId): string {
    return MINTCAT_RELEASE_ORIGINS.find((origin) => origin.id === id)?.labelKey ?? id;
}

export function getMintcatReleaseOriginByPresetId(id: MintcatReleaseOriginId): string {
    const row = MINTCAT_RELEASE_ORIGINS.find((origin) => origin.id === id);
    return row?.manifestUrl ?? getMintcatUpdateManifestLanguageFallback();
}

export function setMintcatUpdateManifestResolvedUrl(manifestUrl: string | null): void {
    resolvedUpdateManifestUrl = manifestUrl ? resolveManifestUrl(manifestUrl) : null;
}

export function getMintcatUpdateManifestResolvedUrl(): string | null {
    return resolvedUpdateManifestUrl;
}

/** 按当前界面语言选择更新清单：中文 → 杭州，否则 → 新加坡 */
export function getMintcatUpdateManifestLanguageFallback(): string {
    return i18n.language?.startsWith('zh') ? MINTCAT_UPDATE_MANIFEST_URL_HZ : MINTCAT_UPDATE_MANIFEST_URL_SG;
}

/** 按设置页选择的资源节点返回更新清单；未初始化前回退到界面语言默认节点。 */
export function getMintcatUpdateManifestUrl(): string {
    return resolvedUpdateManifestUrl ?? getMintcatUpdateManifestLanguageFallback();
}

// ---------------------------------------------------------------------------
// Manifest 拉取与下载 URL
// ---------------------------------------------------------------------------

/** 按 manifest URL 缓存进行中的拉取 Promise，避免重复请求 */
const updateManifestCache = new Map<string, Promise<UpdateCheckManifestItem[]>>();

/**
 * i18n key when network/API fails during update check (avoids raw "Load failed")
 * 更新检查失败时抛出的错误 message，UI 侧应翻译此 key 而非展示原始网络错误。
 */
export const RELEASE_CHECK_NETWORK_ERROR_KEY = 'error.release_check_network';

/** 组件类型/别名 → 清单中对应的静态文件名（用于拼 OSS 直链） */
const UPDATE_ASSET_FILE_NAMES: Record<string, string> = {
    ue4ssl: 'UE4SSL.zip',
    drg: 'DRG.zip',
    rc: 'RC.zip',
    integrator: 'mintcat_integrator.dll',
    frontend: 'mintcat-frontend.zip',
};

/** 从完整 manifest URL 截取目录前缀，用于拼接相对路径资源 */
function getUpdateManifestBaseUrl(manifestUrl: string = getMintcatUpdateManifestUrl()): string {
    return manifestUrl.slice(0, manifestUrl.lastIndexOf('/') + 1);
}

/** 根据名称或类型解析清单里的文件名；未知类型则回退为 `{key}.zip` */
function getAssetFileName(nameOrType: string | undefined): string {
    const key = normalizeManifestKey(nameOrType);
    return UPDATE_ASSET_FILE_NAMES[key] ?? `${key || 'asset'}.zip`;
}

/**
 * Build full download URL from relative path returned by update manifest.
 * 将清单中的相对路径或已是 http(s) 的地址转为最终可下载的绝对 URL。
 */
export function getDownloadUrl(relativeOrFull: string, manifestUrl: string = getMintcatUpdateManifestUrl()): string {
    if (relativeOrFull.startsWith('http://') || relativeOrFull.startsWith('https://')) {
        return relativeOrFull;
    }
    return new URL(relativeOrFull.replace(/^\/+/, ''), getUpdateManifestBaseUrl(manifestUrl)).toString();
}

/**
 * Build a static OSS download URL for an internal asset.
 * The new update flow is driven by update.json instead of the legacy Release API download endpoint.
 * 按 appType 映射文件名后与 manifest 基址拼接；`_platform` / `_channel` 为兼容旧签名的占位参数。
 */
export function getReleaseDownloadUrl(
    _version: string,
    appType: string,
    _platform: string = 'windows',
    _channel: string = DEFAULT_RELEASE_CHANNEL,
    manifestUrl: string = getMintcatUpdateManifestUrl(),
): string {
    const fileName = getAssetFileName(appType);
    return getDownloadUrl(fileName, manifestUrl);
}

/**
 * 将用户传入的 base（可为目录或完整 json URL）规范为最终的 update.json 地址。
 */
function resolveManifestUrl(baseUrl?: string): string {
    const defaultUrl = getMintcatUpdateManifestUrl();
    if (!baseUrl || baseUrl.trim() === '') return defaultUrl;
    const value = baseUrl.trim();
    if (value.endsWith('.json')) return value;
    return new URL('update.json', value.replace(/\/+$/, '/') || defaultUrl).toString();
}

/** 优先使用清单项自带的 url/path，否则按版本与类型拼默认下载地址 */
function getManifestItemDownloadUrl(item: UpdateCheckManifestItem, manifestUrl: string): string {
    const url = getManifestItemDownloadPath(item);
    if (url && url.trim() !== '') {
        return getDownloadUrl(url, manifestUrl);
    }
    return getReleaseDownloadUrl(item.latestVersion, item.name || item.type, undefined, item.channel, manifestUrl);
}

/** 调用后端拉取并校验清单；失败时抛出 RELEASE_CHECK_NETWORK_ERROR_KEY 供 i18n */
async function requestUpdateManifest(manifestUrl: string): Promise<UpdateCheckManifestItem[]> {
    try {
        const data = await invoke<UpdateCheckManifestItem[]>('fetch_update_manifest', {
            url: manifestUrl,
        });
        if (!Array.isArray(data)) {
            throw new Error('Invalid response: update manifest array required');
        }
        return data;
    } catch {
        throw new Error(RELEASE_CHECK_NETWORK_ERROR_KEY);
    }
}

/**
 * 获取更新清单（带缓存）。`forceRefresh` 为 true 时丢弃该 URL 的缓存并重新请求。
 */
export async function fetchUpdateManifest(baseUrl?: string, forceRefresh = false): Promise<UpdateCheckManifestItem[]> {
    const manifestUrl = resolveManifestUrl(baseUrl);
    if (forceRefresh) {
        updateManifestCache.delete(manifestUrl);
    }

    let manifestPromise = updateManifestCache.get(manifestUrl);
    if (!manifestPromise) {
        manifestPromise = requestUpdateManifest(manifestUrl).catch((error) => {
            updateManifestCache.delete(manifestUrl);
            throw error;
        });
        updateManifestCache.set(manifestUrl, manifestPromise);
    }
    return manifestPromise;
}

/** 主动预热清单：强制刷新并返回最新数据，适合启动时预加载 */
export function prefetchUpdateManifest(baseUrl?: string): Promise<UpdateCheckManifestItem[]> {
    return fetchUpdateManifest(baseUrl, true);
}

/**
 * Batch check updates from the unified static update.json manifest.
 * Returns results in same order as items.
 * 对 `items` 中每一项在清单里找匹配行，比较 `latestVersion` 与 `currentVersion`，输出顺序与输入一致。
 */
export async function checkUpdatesBatch(
    items: UpdateCheckItem[],
    baseUrl?: string,
): Promise<UpdateCheckResult[]> {
    const manifest = await fetchUpdateManifest(baseUrl);

    const manifestUrl = resolveManifestUrl(baseUrl);

    return items.map((item) => {
        const matched = manifest.find((row) => matchesRequestedUpdateItem(row, item));
        const appType = item.appType ?? item.name ?? item.type ?? '';
        if (!matched) {
            return {
                hasUpdate: false,
                appType,
                currentVersion: item.currentVersion,
            };
        }

        const latestVersion = matched.latestVersion ?? '0';
        const hasUpdate = compareVersion(latestVersion, item.currentVersion) > 0;
        const checksum = getManifestItemChecksum(matched);
        return {
            hasUpdate,
            appType: matched.name || appType || matched.type,
            currentVersion: item.currentVersion,
            latestVersion,
            isMandatory: matched.isMandatory,
            releaseNotes: matched.releaseNotes ?? '',
            downloadUrl: getManifestItemDownloadUrl(matched, manifestUrl),
            fileSize: matched.fileSize,
            checksum,
            md5: matched.md5,
            sha256: matched.sha256,
            signature: matched.signature,
            name: matched.name,
            type: matched.type,
            channel: matched.channel,
        };
    });
}
