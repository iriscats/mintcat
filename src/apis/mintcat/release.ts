import type { UpdateCheckItem, UpdateCheckManifestItem, UpdateCheckResult } from './types';
import { NetworkApi } from '@/apis/NetworkApi';
import { NetworkRequestError } from '@/services/network';
import { DEFAULT_RELEASE_CHANNEL } from './releaseChannel';

export const MINTCAT_UPDATE_MANIFEST_URL = 'https://yuri-oss-hz.oss-cn-hangzhou.aliyuncs.com/update.json';

const updateManifestCache = new Map<string, Promise<UpdateCheckManifestItem[]>>();

/** i18n key when network/API fails during update check (avoids raw "Load failed") */
export const RELEASE_CHECK_NETWORK_ERROR_KEY = 'error.release_check_network';

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

function getUpdateManifestBaseUrl(manifestUrl: string = MINTCAT_UPDATE_MANIFEST_URL): string {
    return manifestUrl.slice(0, manifestUrl.lastIndexOf('/') + 1);
}

function normalizeAssetKey(value: string | undefined): string {
    return (value ?? '').trim().toLowerCase();
}

function getAssetFileName(nameOrType: string | undefined): string {
    const key = normalizeAssetKey(nameOrType);
    return UPDATE_ASSET_FILE_NAMES[key] ?? `${key || 'asset'}.zip`;
}

/**
 * Build full download URL from relative path returned by update manifest.
 */
export function getDownloadUrl(relativeOrFull: string, manifestUrl: string = MINTCAT_UPDATE_MANIFEST_URL): string {
    if (relativeOrFull.startsWith('http://') || relativeOrFull.startsWith('https://')) {
        return relativeOrFull;
    }
    return new URL(relativeOrFull.replace(/^\/+/, ''), getUpdateManifestBaseUrl(manifestUrl)).toString();
}

/**
 * Build a static OSS download URL for an internal asset.
 * The new update flow is driven by update.json instead of the legacy Release API download endpoint.
 */
export function getReleaseDownloadUrl(
    version: string,
    appType: string,
    _platform: string = 'windows',
    _channel: string = DEFAULT_RELEASE_CHANNEL,
    manifestUrl: string = MINTCAT_UPDATE_MANIFEST_URL,
): string {
    const fileName = getAssetFileName(appType);
    const versionedFileName = version ? fileName : fileName;
    return getDownloadUrl(versionedFileName, manifestUrl);
}

function resolveManifestUrl(baseUrl?: string): string {
    if (!baseUrl || baseUrl.trim() === '') return MINTCAT_UPDATE_MANIFEST_URL;
    const value = baseUrl.trim();
    if (value.endsWith('.json')) return value;
    return new URL('update.json', value.replace(/\/+$/, '/') || MINTCAT_UPDATE_MANIFEST_URL).toString();
}

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

function getManifestItemDownloadUrl(item: UpdateCheckManifestItem, manifestUrl: string): string {
    const url = item.downloadUrl ?? item.url ?? item.path;
    if (url && url.trim() !== '') {
        return getDownloadUrl(url, manifestUrl);
    }
    return getReleaseDownloadUrl(item.latestVersion, item.name || item.type, undefined, item.channel, manifestUrl);
}

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

async function requestUpdateManifest(manifestUrl: string): Promise<UpdateCheckManifestItem[]> {
    let response: Response;
    try {
        const result = await NetworkApi.request<Response>({
            service: 'mintcat.release.updateManifest',
            url: manifestUrl,
            method: 'GET',
            proxyPolicy: 'direct',
            parseAs: 'response',
        });
        response = result.response;
    } catch (e) {
        if (
            e instanceof NetworkRequestError &&
            (e.code === 'network' || e.code === 'timeout')
        ) {
            throw new Error(RELEASE_CHECK_NETWORK_ERROR_KEY);
        }
        throw new Error(RELEASE_CHECK_NETWORK_ERROR_KEY);
    }

    if (!response.ok) {
        throw new Error(`Release manifest request failed: ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
        throw new Error('Invalid response: update manifest array required');
    }
    return data as UpdateCheckManifestItem[];
}

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

export function prefetchUpdateManifest(baseUrl?: string): Promise<UpdateCheckManifestItem[]> {
    return fetchUpdateManifest(baseUrl, true);
}

/**
 * Batch check updates from the unified static update.json manifest.
 * Returns results in same order as items.
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
            checksum: matched.checksum ?? matched.sha256 ?? matched.md5,
            md5: matched.md5 ?? matched.checksum,
            sha256: matched.sha256,
            signature: matched.signature,
            name: matched.name,
            type: matched.type,
            channel: matched.channel,
        };
    });
}
