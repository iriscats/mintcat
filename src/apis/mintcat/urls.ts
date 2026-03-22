/**
 * MintCat 后端 API 的默认源站与路径约定（单处维护，避免各文件重复硬编码）。
 * 中文用户走 v1st.net，其余走 mintcat.work。
 */
import i18n from '@/locales/i18n';

const MINTCAT_API_ORIGIN_ZH = 'https://api.v1st.net';
const MINTCAT_API_ORIGIN_GLOBAL = 'https://api.mintcat.work';

export function getMintcatApiOrigin(): string {
    return i18n.language?.startsWith('zh') ? MINTCAT_API_ORIGIN_ZH : MINTCAT_API_ORIGIN_GLOBAL;
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
