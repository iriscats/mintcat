import type { UpdateCheckItem, UpdateCheckResult } from './types';

const RELEASE_API_BASE_URL = 'https://api.mintcat.work';

function getBaseUrl(): string {
    return RELEASE_API_BASE_URL;
}

/**
 * Build full download URL from relative path returned by API.
 */
export function getDownloadUrl(relativeOrFull: string): string {
    if (relativeOrFull.startsWith('http://') || relativeOrFull.startsWith('https://')) {
        return relativeOrFull;
    }
    const base = getBaseUrl().replace(/\/$/, '');
    const path = relativeOrFull.startsWith('/') ? relativeOrFull : `/${relativeOrFull}`;
    return `${base}${path}`;
}

/**
 * 按 API 文档「4. 下载发布文件」构造下载地址：
 * GET /releases/{version}/download?appType={type}&platform={platform}&channel={channel}
 */
export function getReleaseDownloadUrl(
    version: string,
    appType: string,
    platform: string = 'windows',
    channel: string = 'beta',
    baseUrl?: string
): string {
    const base = (baseUrl ?? getBaseUrl()).replace(/\/$/, '');
    const params = new URLSearchParams({ appType, platform, channel });
    return `${base}/releases/${encodeURIComponent(version)}/download?${params.toString()}`;
}

/**
 * Batch check updates (POST /releases/check-update).
 * Returns results in same order as items.
 */
export async function checkUpdatesBatch(
    items: UpdateCheckItem[],
    baseUrl?: string
): Promise<UpdateCheckResult[]> {
    const base = baseUrl ?? getBaseUrl();
    const url = `${base.replace(/\/$/, '')}/releases/check-update`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(
            (err as { message?: string }).message || `Release API error: ${response.status}`
        );
    }
    const data = (await response.json()) as { items: UpdateCheckResult[] };
    if (!Array.isArray(data.items)) {
        throw new Error('Invalid response: items array required');
    }
    return data.items;
}
