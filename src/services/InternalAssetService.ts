import { exists, readTextFile, writeFile, remove } from '@tauri-apps/plugin-fs';
import { t } from 'i18next';
import {
    checkUpdatesBatch,
    DEFAULT_RELEASE_CHANNEL,
    getDownloadUrl,
    getReleaseDownloadUrl,
    normalizeReleaseChannel,
    type ReleaseChannel,
} from '@/apis/mintcat';
import { DownloadApi } from '@/apis/DownloadApi';
import { CacheApi } from '@/apis/CacheApi';
import { IntegrateApi } from '@/apis/IntegrateApi';
import { StorageAPI } from '@/storage';
import { HotUpdateStoreApi, type HotUpdateComponentKey } from '@/apis/HotUpdateStoreApi';

const ASSET_UE4SSL = 'UE4SSL.zip';
const ASSET_DRG = 'DRG.zip';
const ASSET_RC = 'RC.zip';
const PLATFORM = 'windows';
const ARCH = 'x86_64';
const MANIFEST_FILENAME = 'assets_manifest.json';

function joinPath(cacheDir: string, name: string): string {
    const sep = cacheDir.includes('\\') ? '\\' : '/';
    const norm = cacheDir.replace(/[/\\]+$/, '');
    return `${norm}${sep}${name}`;
}

export interface EnsureInternalAssetsOptions {
    setStep?: (name: string, current: number, total: number) => Promise<void>;
    setMessage?: (msg: string, level?: 'info' | 'warning' | 'error') => Promise<void>;
    updateProgress?: (p: number) => void;
    checkCancelled?: () => boolean;
    /** 'drg' 下载 DRG.zip，'rc' 下载 RC.zip；includeUe4ss=true 时额外下载 UE4SSL.zip */
    game?: InternalAssetGame;
    includeUe4ss?: boolean;
}

export interface InternalAssetPaths {
    ue4ssZipPath?: string;
    drgZipPath?: string;
    rcZipPath?: string;
}

export type InternalAssetGame = 'drg' | 'rc';

interface AssetManifest {
    ue4ssl: string;
    drg: string;
    rc: string;
    /** 与设置中发布渠道一致；旧 manifest 无此字段时视为 stable */
    channel: ReleaseChannel;
}

const DEFAULT_MANIFEST: AssetManifest = {
    ue4ssl: '0',
    drg: '0',
    rc: '0',
    channel: DEFAULT_RELEASE_CHANNEL,
};
const MAX_DOWNLOAD_RETRIES = 3;
const RETRY_BACKOFF_MS = 1200;
const PROGRESS_MESSAGE_INTERVAL_MS = 1000;

async function removeInternalAssetZips(cacheDir: string): Promise<void> {
    for (const name of [ASSET_UE4SSL, ASSET_DRG, ASSET_RC]) {
        const zipPath = joinPath(cacheDir, name);
        try {
            if (await exists(zipPath)) {
                await remove(zipPath);
            }
        } catch (_) {
            /* best effort */
        }
    }
}

/** 读取 manifest；若文件缺失或解析错误则返回默认值并标记 invalid */
async function readManifest(cacheDir: string): Promise<{ manifest: AssetManifest; valid: boolean }> {
    const path = joinPath(cacheDir, MANIFEST_FILENAME);
    try {
        if (await exists(path)) {
            const content = await readTextFile(path);
            const data = JSON.parse(content) as {
                ue4ssl?: string;
                drg?: string;
                rc?: string;
                channel?: string;
            };
            const channelRaw = data.channel;
            const channel =
                channelRaw != null && String(channelRaw).trim() !== ''
                    ? normalizeReleaseChannel(String(channelRaw))
                    : DEFAULT_RELEASE_CHANNEL;
            return {
                manifest: {
                    ue4ssl: data.ue4ssl ?? '0',
                    drg: data.drg ?? '0',
                    rc: data.rc ?? '0',
                    channel,
                },
                valid: true,
            };
        }
    } catch (_) {
        // 文件缺失或 JSON 解析错误
    }
    return { manifest: { ...DEFAULT_MANIFEST }, valid: false };
}

async function writeManifest(cacheDir: string, updates: Partial<AssetManifest>): Promise<void> {
    const path = joinPath(cacheDir, MANIFEST_FILENAME);
    const { manifest: current } = await readManifest(cacheDir);
    const merged = { ...current, ...updates };
    const content = JSON.stringify(merged);
    const bytes = new TextEncoder().encode(content);
    await writeFile(path, bytes);
}

/** Validate a cached ZIP and remove it if corrupted; returns true if valid */
async function validateAndCleanZip(
    zipPath: string,
    cacheDir: string,
    manifestKey: 'ue4ssl' | 'drg' | 'rc',
    manifest: AssetManifest,
): Promise<boolean> {
    if (!(await exists(zipPath))) return false;
    const valid = await IntegrateApi.validateZipFile(zipPath);
    if (!valid) {
        console.warn(`[InternalAssets] Corrupted ZIP detected, removing: ${zipPath}`);
        try { await remove(zipPath); } catch (_) { /* best effort */ }
        if (manifest[manifestKey] !== '0') {
            await writeManifest(cacheDir, { [manifestKey]: '0' });
            manifest[manifestKey] = '0';
        }
        return false;
    }
    return true;
}

async function validateZipPath(zipPath: string): Promise<boolean> {
    if (!(await exists(zipPath))) return false;
    const valid = await IntegrateApi.validateZipFile(zipPath);
    if (!valid) {
        console.warn(`[InternalAssets] Corrupted ZIP detected, removing: ${zipPath}`);
        try { await remove(zipPath); } catch (_) { /* best effort */ }
    }
    return valid;
}

function internalAssetKey(
    component: 'ue4ssl' | 'drg' | 'rc',
    game: InternalAssetGame,
    channel: ReleaseChannel,
): HotUpdateComponentKey {
    return {
        category: 'internal-assets',
        component,
        game,
        channel,
        platform: PLATFORM,
        arch: ARCH,
    };
}

async function internalAssetPath(
    component: 'ue4ssl' | 'drg' | 'rc',
    game: InternalAssetGame,
    channel: ReleaseChannel,
    version: string,
    fileName: string,
): Promise<string> {
    return HotUpdateStoreApi.resolveArtifactPath({
        ...internalAssetKey(component, game, channel),
        version,
        fileName,
    });
}

async function readInternalAssetActive(
    component: 'ue4ssl' | 'drg' | 'rc',
    game: InternalAssetGame,
    channel: ReleaseChannel,
    fileName: string,
): Promise<{ version: string; path: string; valid: boolean }> {
    const key = internalAssetKey(component, game, channel);
    const state = await HotUpdateStoreApi.getComponentState(key);
    const version = state.activeVersion || '0';
    const path = await internalAssetPath(component, game, channel, version, state.activeFileName || fileName);
    const valid = version !== '0' && await validateZipPath(path);
    if (!valid && version !== '0') {
        await HotUpdateStoreApi.markComponentFailed(key, version, state.activeFileName || fileName, {
            reason: 'zip-validation-failed',
        });
    }
    return { version: valid ? version : '0', path, valid };
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let idx = 0;
    while (value >= 1024 && idx < units.length - 1) {
        value /= 1024;
        idx += 1;
    }
    const precision = value >= 100 || idx === 0 ? 0 : value >= 10 ? 1 : 2;
    return `${value.toFixed(precision)} ${units[idx]}`;
}

function formatEta(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) return '--:--';
    const total = Math.ceil(seconds);
    const mm = String(Math.floor(total / 60)).padStart(2, '0');
    const ss = String(total % 60).padStart(2, '0');
    return `${mm}:${ss}`;
}

/**
 * Ensure internal asset zips exist in cache, downloading with MD5 check if missing or outdated.
 * Validates cached ZIP integrity; corrupted files are removed and re-downloaded automatically.
 * - game 'drg': DRG.zip
 * - game 'rc': RC.zip
 * - includeUe4ss: additionally requires UE4SSL.zip
 * Used by CheckModUpdateTask and ModInstallTask.
 */
export async function ensureInternalAssets(
    options?: EnsureInternalAssetsOptions
): Promise<InternalAssetPaths> {
    const opts = options ?? {};
    const setStep = opts.setStep ?? (async () => {});
    const setMessage = opts.setMessage ?? (async () => {});
    const updateProgress = opts.updateProgress ?? (() => {});
    const checkCancelled = opts.checkCancelled ?? (() => false);
    const game: InternalAssetGame = opts.game ?? 'drg';
    const includeUe4ss = opts.includeUe4ss ?? true;

    const settings = await StorageAPI.getSettings();
    const channel = await settings.getReleaseChannel();

    const secondAppType = game === 'rc' ? 'rc' : 'drg';
    const secondAssetName = game === 'rc' ? ASSET_RC : ASSET_DRG;
    const secondManifestKey: 'drg' | 'rc' = game === 'rc' ? 'rc' : 'drg';

    const ue4ssActive = includeUe4ss
        ? await readInternalAssetActive('ue4ssl', game, channel, ASSET_UE4SSL)
        : { version: '0', path: '', valid: true };
    const secondActive = await readInternalAssetActive(secondManifestKey, game, channel, secondAssetName);

    const ue4ssZipPath = ue4ssActive.path;
    let secondZipPath = secondActive.path;

    const ue4sslVersionForCheck = ue4ssActive.valid ? ue4ssActive.version : '0';
    const secondVersionForCheck = secondActive.valid ? secondActive.version : '0';

    await setMessage(t('status.checkingInternalAssetsForUpdates'));
    let results;
    try {
        const updateChecks = [
            ...(includeUe4ss
                ? [{ currentVersion: ue4sslVersionForCheck, appType: 'ue4ssl', platform: PLATFORM, channel }]
                : []),
            { currentVersion: secondVersionForCheck, appType: secondAppType, platform: PLATFORM, channel },
        ];
        results = await checkUpdatesBatch(updateChecks);
    } catch (error) {
        console.error('[InternalAssets] Failed to check update metadata:', error);
        throw new Error(t('error.checkInternalAssetsUpdates'));
    }
    const ue4sslResult = includeUe4ss ? results[0] : null;
    const secondResult = includeUe4ss ? results[1] : results[0];

    const needUe4ssl =
        includeUe4ss &&
        (!ue4ssActive.valid ||
            (ue4sslResult?.hasUpdate && ue4sslResult.latestVersion != null && ue4sslResult.md5 != null));
    const needSecond =
        !secondActive.valid ||
        (secondResult.hasUpdate && secondResult.latestVersion != null && secondResult.md5 != null);

    const downloadQueue: Array<{
        result: { latestVersion?: string; md5?: string; downloadUrl?: string };
        appType: string;
        destPath: string;
        manifestKey: 'ue4ssl' | 'drg' | 'rc';
    }> = [];

    if (needUe4ssl) {
        const r = ue4sslResult!;
        if (!r.latestVersion || !r.md5) {
            throw new Error(t('mod.missingVersionOrMd5', { name: 'UE4SSL' }));
        }
        const destPath = await internalAssetPath('ue4ssl', game, channel, r.latestVersion, ASSET_UE4SSL);
        downloadQueue.push({ result: r, appType: 'ue4ssl', destPath, manifestKey: 'ue4ssl' });
    }

    if (needSecond) {
        const r = secondResult;
        const label = game === 'rc' ? 'RC' : 'DRG';
        if (!r.latestVersion || !r.md5) {
            throw new Error(t('mod.missingVersionOrMd5', { name: label }));
        }
        secondZipPath = await internalAssetPath(secondManifestKey, game, channel, r.latestVersion, secondAssetName);
        downloadQueue.push({
            result: r,
            appType: secondAppType,
            destPath: secondZipPath,
            manifestKey: secondManifestKey,
        });
    }

    if (downloadQueue.length === 0) {
        await setMessage(t('internalAssets.upToDate'));
    } else {
        for (let i = 0; i < downloadQueue.length; i++) {
            if (checkCancelled()) throw new Error(t('Task Cancelled'));
            const item = downloadQueue[i];
            const label = `${item.appType.toUpperCase()}.zip`;
            const current = i + 1;
            const total = downloadQueue.length;

            await setMessage(t('download.preparingWithIndex', { current, total, name: label }));
            await downloadAndValidateZip(
                item.result,
                item.appType,
                item.destPath,
                item.manifestKey,
                game,
                channel,
                setMessage,
                checkCancelled,
                (percent) => {
                    const overall = Math.floor((((current - 1) * 100) + percent) / total);
                    updateProgress(Math.min(99, overall));
                },
                current,
                total,
            );
            updateProgress(Math.floor((current * 100) / total));
        }
        await setMessage(t('internalAssets.downloadCompleted'));
    }

    updateProgress(100);

    // 最终校验：确认文件存在且为有效 ZIP
    const ue4ssOk = !includeUe4ss || (await exists(ue4ssZipPath) && await IntegrateApi.validateZipFile(ue4ssZipPath));
    const secondOk = await exists(secondZipPath) && await IntegrateApi.validateZipFile(secondZipPath);
    if (!ue4ssOk || !secondOk) {
        const missing = [(!ue4ssOk && ASSET_UE4SSL), (!secondOk && (game === 'rc' ? ASSET_RC : ASSET_DRG))].filter(Boolean);
        throw new Error(t('internalAssets.missingAfterCheck', { files: missing.join(', ') }));
    }

    if (game === 'rc') {
        return { ue4ssZipPath: includeUe4ss ? ue4ssZipPath : undefined, rcZipPath: secondZipPath };
    }
    return { ue4ssZipPath: includeUe4ss ? ue4ssZipPath : undefined, drgZipPath: secondZipPath };
}

/** Download a ZIP asset with post-download validation and automatic retry */
async function downloadAndValidateZip(
    result: { latestVersion?: string; md5?: string; downloadUrl?: string },
    appType: string,
    destPath: string,
    manifestKey: 'ue4ssl' | 'drg' | 'rc',
    game: InternalAssetGame,
    channel: ReleaseChannel,
    setMessage: (msg: string, level?: 'info' | 'warning' | 'error') => Promise<void>,
    checkCancelled: () => boolean,
    onProgress: (percent: number) => void,
    current: number,
    total: number,
): Promise<void> {
    const label = appType.toUpperCase();
    const fileName = `${label}.zip`;
    let lastError = '';

    for (let attempt = 0; attempt < MAX_DOWNLOAD_RETRIES; attempt++) {
        if (checkCancelled()) throw new Error(t('Task Cancelled'));
        let statusError = '';
        const attemptNumber = attempt + 1;

        if (attemptNumber > 1) {
            await setMessage(t('download.retryingWithAttempt', {
                name: fileName,
                current,
                total,
                n: attemptNumber,
                max: MAX_DOWNLOAD_RETRIES,
            }), 'warning');
            console.warn(`[InternalAssets] Retry ${attemptNumber}/${MAX_DOWNLOAD_RETRIES} for ${fileName}`);
        } else {
            await setMessage(t('download.progressWithIndex', { name: fileName, current, total }));
        }

        const downloadUrl = result.downloadUrl
            ? getDownloadUrl(result.downloadUrl)
            : getReleaseDownloadUrl(result.latestVersion!, appType, PLATFORM, channel);

        let lastReportedPercent = -1;
        let lastReportedAt = 0;
        try {
            await DownloadApi.downloadFile(
                downloadUrl,
                destPath,
                { checksum: result.md5!, checksumType: 'md5' },
                (downloaded, totalBytes, speedBytesPerSec, etaSecs) => {
                    const percent = totalBytes > 0
                        ? Math.min(100, Math.floor((downloaded / totalBytes) * 100))
                        : 0;
                    onProgress(percent);

                    const now = Date.now();
                    const shouldReport =
                        percent === 100 ||
                        percent >= lastReportedPercent + 5 ||
                        now - lastReportedAt >= PROGRESS_MESSAGE_INTERVAL_MS;
                    if (!shouldReport) return;

                    lastReportedPercent = percent;
                    lastReportedAt = now;
                    const speed = speedBytesPerSec > 0 ? `${formatBytes(speedBytesPerSec)}/s` : '--';
                    const detail = totalBytes > 0
                        ? t('Download detail with total', {
                            downloaded: formatBytes(downloaded),
                            total: formatBytes(totalBytes),
                            speed,
                            eta: formatEta(etaSecs),
                        })
                        : t('Download detail without total', {
                            downloaded: formatBytes(downloaded),
                            speed,
                        });
                    void setMessage(t('download.progressWithPercent', {
                        name: fileName,
                        current,
                        total,
                        percent,
                        detail,
                    }));
                },
                (status, error) => {
                    if (status === 'failed') {
                        statusError = error || '';
                    }
                },
            );
        } catch (error) {
            lastError = statusError || ((error as Error)?.message || t('Network Error'));
            console.error(`[InternalAssets] Download failed for ${fileName} (attempt ${attemptNumber}):`, error);
            try { await remove(destPath); } catch (_) { /* best effort */ }
            if (attemptNumber < MAX_DOWNLOAD_RETRIES) {
                await setMessage(t('download.failedWaitRetry', {
                    name: fileName,
                    error: lastError,
                }), 'warning');
                await sleep(RETRY_BACKOFF_MS * attemptNumber);
                continue;
            }
            throw new Error(t('error.downloadValidAfterAttempts', {
                name: fileName,
                n: MAX_DOWNLOAD_RETRIES,
            }) + `: ${lastError}`);
        }
        onProgress(100);

        if (await IntegrateApi.validateZipFile(destPath)) {
            await HotUpdateStoreApi.activateComponent(
                internalAssetKey(manifestKey, game, channel),
                result.latestVersion!,
                manifestKey === 'ue4ssl' ? ASSET_UE4SSL : manifestKey === 'rc' ? ASSET_RC : ASSET_DRG,
                {
                    checksum: result.md5,
                    channel,
                    game,
                },
            );
            await setMessage(t('download.successWithName', { name: fileName }));
            return;
        }

        lastError = statusError || t('Downloaded file is corrupted');
        console.error(`[InternalAssets] Downloaded ${fileName} is corrupted (attempt ${attemptNumber})`);
        try { await remove(destPath); } catch (_) { /* best effort */ }
        if (attemptNumber < MAX_DOWNLOAD_RETRIES) {
            await setMessage(t('download.failedWaitRetry', {
                name: fileName,
                error: lastError,
            }), 'warning');
            await sleep(RETRY_BACKOFF_MS * attemptNumber);
        }
    }

    throw new Error(t('error.downloadValidAfterAttempts', {
        name: fileName,
        n: MAX_DOWNLOAD_RETRIES,
    }) + (lastError ? `: ${lastError}` : ''));
}

/**
 * Get paths to internal asset zips. Returns null if any required file is missing.
 * - game 'drg': requires DRG.zip
 * - game 'rc': requires RC.zip
 * - includeUe4ss: additionally requires UE4SSL.zip
 */
export async function getInternalAssetPaths(
    game: InternalAssetGame = 'drg',
    includeUe4ss = true,
): Promise<InternalAssetPaths | null> {
    const settings = await StorageAPI.getSettings();
    const channel = await settings.getReleaseChannel();
    const ue4ssActive = includeUe4ss
        ? await readInternalAssetActive('ue4ssl', game, channel, ASSET_UE4SSL)
        : { version: '0', path: undefined as string | undefined, valid: true };
    const secondManifestKey: 'drg' | 'rc' = game === 'rc' ? 'rc' : 'drg';
    const secondAssetName = game === 'rc' ? ASSET_RC : ASSET_DRG;
    const secondActive = await readInternalAssetActive(secondManifestKey, game, channel, secondAssetName);
    const hasUe4ss = !includeUe4ss || ue4ssActive.valid;
    if (game === 'rc') {
        if (hasUe4ss && secondActive.valid) {
            return { ue4ssZipPath: includeUe4ss ? ue4ssActive.path : undefined, rcZipPath: secondActive.path };
        }
    } else {
        if (hasUe4ss && secondActive.valid) {
            return { ue4ssZipPath: includeUe4ss ? ue4ssActive.path : undefined, drgZipPath: secondActive.path };
        }
    }
    return null;
}
