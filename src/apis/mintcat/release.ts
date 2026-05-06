/**
 * MintCat 发布与更新检查：从静态 manifest（update.json）拉取各组件版本信息，
 * 解析下载地址、比对 semver 风格版本号，并批量返回是否有更新及下载元数据。
 * 实际网络请求通过 Tauri `fetch_update_manifest` 在 Rust 侧完成。
 */
import type { UpdateCheckItem, UpdateCheckManifestItem, UpdateCheckResult } from './types';
import { invoke } from '@tauri-apps/api/core';
import i18n from '@/locales/i18n';
import { DEFAULT_RELEASE_CHANNEL } from './releaseChannel';

/** 杭州 OSS 上的 update.json（中文界面默认） */
export const MINTCAT_UPDATE_MANIFEST_URL = 'https://yuri-oss-hz.oss-cn-hangzhou.aliyuncs.com/update.json';

/** 新加坡 OSS 上的 update.json（非中文界面默认，含英文） */
export const MINTCAT_UPDATE_MANIFEST_URL_SG = 'https://yuri-oss-sg.oss-ap-southeast-1.aliyuncs.com/update.json';

/** 按当前界面语言选择更新清单：中文 → 杭州，否则 → 新加坡 */
export function getMintcatUpdateManifestUrl(): string {
    return i18n.language?.startsWith('zh') ? MINTCAT_UPDATE_MANIFEST_URL : MINTCAT_UPDATE_MANIFEST_URL_SG;
}

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
    ue4ss: 'UE4SSL.zip',
    drg: 'DRG.zip',
    rc: 'RC.zip',
    'mintcat-integrator': 'mintcat_integrator.dll',
    integrator: 'mintcat_integrator.dll',
    'mintcat-frontend': 'mintcat-frontend.zip',
    frontend: 'mintcat-frontend.zip',
};

/** 从完整 manifest URL 截取目录前缀，用于拼接相对路径资源 */
function getUpdateManifestBaseUrl(manifestUrl: string = getMintcatUpdateManifestUrl()): string {
    return manifestUrl.slice(0, manifestUrl.lastIndexOf('/') + 1);
}

/** 统一 appType/name/type 等字段的比对键（去空白、小写） */
function normalizeAssetKey(value: string | undefined): string {
    return (value ?? '').trim().toLowerCase();
}

/** 根据名称或类型解析清单里的文件名；未知类型则回退为 `{key}.zip` */
function getAssetFileName(nameOrType: string | undefined): string {
    const key = normalizeAssetKey(nameOrType);
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
    version: string,
    appType: string,
    _platform: string = 'windows',
    _channel: string = DEFAULT_RELEASE_CHANNEL,
    manifestUrl: string = getMintcatUpdateManifestUrl(),
): string {
    const fileName = getAssetFileName(appType);
    const versionedFileName = version ? fileName : fileName;
    return getDownloadUrl(versionedFileName, manifestUrl);
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

/**
 * 语义化版本比较：按 `.`、`-` 分段解析为数字逐段比较；非法段视为 0。
 * 返回值 > 0 表示 left 新于 right。
 */
function compareVersion(left: string, right: string): number {
    const parse = (value: string) => value
        .split(/[.-]/)
        .map((part) => Number.parseInt(part, 10))
        .map((part) => (Number.isFinite(part) ? part : 0));
    const a = parse(left);
    const b = parse(right);
    const len = Math.max(a.length, b.length, 3);
    for (let i = 0; i < len; i++) {
        const diff = (a[i] ?? 0) - (b[i] ?? 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

/** 优先使用清单项自带的 url/path，否则按版本与类型拼默认下载地址 */
function getManifestItemDownloadUrl(item: UpdateCheckManifestItem, manifestUrl: string): string {
    const url = item.downloadUrl ?? item.url ?? item.path;
    if (url && url.trim() !== '') {
        return getDownloadUrl(url, manifestUrl);
    }
    return getReleaseDownloadUrl(item.latestVersion, item.name || item.type, undefined, item.channel, manifestUrl);
}

/** 判断清单中的一条是否与本次请求的 appType + channel 匹配（支持 name/type 别名） */
function matchesRequestedItem(manifestItem: UpdateCheckManifestItem, requestItem: UpdateCheckItem): boolean {
    const requestAppType = normalizeAssetKey(requestItem.appType ?? requestItem.name ?? requestItem.type);
    const manifestName = normalizeAssetKey(manifestItem.name);
    const manifestType = normalizeAssetKey(manifestItem.type);
    const manifestChannel = normalizeAssetKey(manifestItem.channel || DEFAULT_RELEASE_CHANNEL);
    const requestChannel = normalizeAssetKey(requestItem.channel || DEFAULT_RELEASE_CHANNEL);

    if (manifestChannel !== requestChannel) return false;
    if (!requestAppType) return false;
    return requestAppType === manifestName || requestAppType === manifestType;
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
        const matched = manifest.find((row) => matchesRequestedItem(row, item));
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
        return {
            hasUpdate,
            appType: matched.name || appType || matched.type,
            currentVersion: item.currentVersion,
            latestVersion,
            isMandatory: matched.isMandatory,
            releaseNotes: matched.releaseNotes ?? '',
            downloadUrl: getManifestItemDownloadUrl(matched, manifestUrl),
            fileSize: matched.fileSize,
            checksum: matched.md5,
            md5: matched.md5,
            signature: matched.signature,
            name: matched.name,
            type: matched.type,
            channel: matched.channel,
        };
    });
}
