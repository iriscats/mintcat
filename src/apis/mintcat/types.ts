/**
 * Types for the static MintCat update manifest.
 */

export interface UpdateCheckItem {
    currentVersion: string;
    name?: string;
    type?: string;
    appType?: string;
    platform?: string;
    channel?: string;
}

export interface UpdateCheckManifestItem {
    name: string;
    type: string;
    channel: string;
    fileSize?: number;
    latestVersion: string;
    md5?: string;
    sha256?: string;
    checksum?: string;
    signature?: string;
    releaseNotes?: string;
    platform?: string;
    arch?: string;
    downloadUrl?: string;
    url?: string;
    path?: string;
    isMandatory?: boolean;
    minAppVersion?: string;
    maxAppVersion?: string;
    entry?: string;
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
    sha256?: string;
    signature?: string;
    name?: string;
    type?: string;
    channel?: string;
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
