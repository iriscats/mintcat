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
}
