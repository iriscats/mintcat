import type { UpdateCheckItem, UpdateCheckResult } from './types';
import { NetworkApi } from '@/apis/NetworkApi';
import { NetworkRequestError } from '@/services/network';
import { DEFAULT_RELEASE_CHANNEL } from './releaseChannel';
import {
    getMintcatApiOrigin,
    MintCatApiUrls,
    mintcatApiUrl,
    mintcatReleaseDownloadUrl,
    normalizeMintcatApiOrigin,
} from './urls';

/**
 * Build full download URL from relative path returned by API.
 */
export function getDownloadUrl(relativeOrFull: string): string {
    if (relativeOrFull.startsWith('http://') || relativeOrFull.startsWith('https://')) {
        return relativeOrFull;
    }
    const path = relativeOrFull.startsWith('/') ? relativeOrFull : `/${relativeOrFull}`;
    return mintcatApiUrl(getMintcatApiOrigin(), path);
}

/**
 * 按 API 文档「4. 下载发布文件」构造下载地址：
 * GET /releases/{version}/download?appType={type}&platform={platform}&channel={channel}
 */
export function getReleaseDownloadUrl(
    version: string,
    appType: string,
    platform: string = 'windows',
    channel: string = DEFAULT_RELEASE_CHANNEL,
    baseUrl?: string,
): string {
    return mintcatReleaseDownloadUrl(baseUrl ?? getMintcatApiOrigin(), version, appType, platform, channel);
}

/**
 * Batch check updates (POST /releases/check-update).
 * Returns results in same order as items.
 */
/** i18n key when network/API fails during update check (avoids raw "Load failed") */
export const RELEASE_CHECK_NETWORK_ERROR_KEY = 'error.release_check_network';

export async function checkUpdatesBatch(
    items: UpdateCheckItem[],
    baseUrl?: string,
): Promise<UpdateCheckResult[]> {
    const origin = normalizeMintcatApiOrigin(baseUrl ?? getMintcatApiOrigin());
    const url = MintCatApiUrls.releases.checkUpdate(origin);
    let response: Response;
    try {
        const result = await NetworkApi.request<Response>({
            service: 'mintcat.release.checkUpdatesBatch',
            url,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items }),
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
        const err = await response.json().catch(() => ({}));
        throw new Error(
            (err as { message?: string }).message || `Release API error: ${response.status}`,
        );
    }
    const data = (await response.json()) as { items: UpdateCheckResult[] };
    if (!Array.isArray(data.items)) {
        throw new Error('Invalid response: items array required');
    }
    return data.items;
}
