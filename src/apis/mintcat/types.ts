/**
 * Types for MintCat Release API (see docs/RELEASE_API.md).
 */

export interface UpdateCheckItem {
    currentVersion: string;
    appType?: string;
    platform?: string;
    channel?: string;
}

export interface UpdateCheckResult {
    hasUpdate: boolean;
    appType: string;
    currentVersion: string;
    latestVersion?: string;
    isMandatory?: boolean;
    releaseNotes?: string;
    downloadUrl?: string;
    fileSize?: number;
    checksum?: string;
    md5?: string;
    /**
     * Magnet URI for BitTorrent-accelerated download.
     * When present, the client will try P2P first and fall back to HTTP on failure/timeout.
     * Should include `xt=urn:btih:<infohash>`, `dn=<filename>`, `tr=<tracker>`, `ws=<https-web-seed>` (BEP 19).
     */
    magnet?: string;
    /**
     * HTTPS URL to a .torrent file. Used when `magnet` is absent.
     * The torrent MUST include at least one `url-list` (BEP 19) pointing to the same HTTPS asset
     * so that clients without peers still complete via Web Seed.
     */
    torrentUrl?: string;
}

/**
 * Types for MintCat Cloud Backup API.
 */

export interface CloudBackupConfig {
    baseUrl: string;
    /** accessToken 来自 oauths 表中的 mintcat 记录，只读 */
    accessToken: string;
}

export interface CloudBackupMetadata {
    createdAt: string;
    size: number;
    checksum?: string;
    appVersion?: string;
    schemaVersion?: string;
    deviceId?: string;
    note?: string;
}

export interface CloudBackupRecord extends CloudBackupMetadata {
    id: string;
}

/**
 * Types for MintCat VIP API.
 */

export interface VipInfo {
    vipType: string | null;
    vipStatus: 'Active' | 'Expired' | 'None';
    vipExpirationTime: string | null;
}
