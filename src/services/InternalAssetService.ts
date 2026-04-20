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

const ASSET_UE4SSL = 'UE4SSL.zip';
const ASSET_DRG = 'DRG.zip';
const ASSET_RC = 'RC.zip';
const PLATFORM = 'windows';
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
    /** 'drg' 下载 ue4ssl + DRG.zip，'rc' 下载 ue4ssl + RC.zip */
    game?: InternalAssetGame;
}

export interface InternalAssetPaths {
    ue4ssZipPath: string;
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
 * - game 'drg': UE4SSL.zip + DRG.zip
 * - game 'rc': UE4SSL.zip + RC.zip
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

    const settings = await StorageAPI.getSettings();
    const channel = await settings.getReleaseChannel();

    const cacheDir = await CacheApi.getCacheDir();
    const ue4ssZipPath = joinPath(cacheDir, ASSET_UE4SSL);
    const drgZipPath = joinPath(cacheDir, ASSET_DRG);
    const rcZipPath = joinPath(cacheDir, ASSET_RC);

    let { manifest, valid: manifestValid } = await readManifest(cacheDir);

    // manifest 缺失或解析错误时强制重新下载并生成 manifest
    let forceRedownload = !manifestValid;

    if (manifestValid && manifest.channel !== channel) {
        await removeInternalAssetZips(cacheDir);
        manifest = {
            ue4ssl: '0',
            drg: '0',
            rc: '0',
            channel,
        };
        await writeManifest(cacheDir, {
            ue4ssl: '0',
            drg: '0',
            rc: '0',
            channel,
        });
        forceRedownload = true;
    }

    // 校验已缓存的 ZIP 文件完整性，损坏的文件会被删除并重置 manifest
    const ue4ssValid = forceRedownload ? false : await validateAndCleanZip(ue4ssZipPath, cacheDir, 'ue4ssl', manifest);
    const secondZipPath = game === 'rc' ? rcZipPath : drgZipPath;
    const secondManifestKey: keyof AssetManifest = game === 'rc' ? 'rc' : 'drg';
    const secondValid = forceRedownload ? false : await validateAndCleanZip(secondZipPath, cacheDir, secondManifestKey, manifest);

    // 缓存文件缺失时与 manifest 同步
    if (!forceRedownload && !ue4ssValid && manifest.ue4ssl !== '0') {
        await writeManifest(cacheDir, { ue4ssl: '0' });
        manifest.ue4ssl = '0';
    }
    if (!forceRedownload && !secondValid && manifest[secondManifestKey] !== '0') {
        await writeManifest(cacheDir, { [secondManifestKey]: '0' });
        manifest[secondManifestKey] = '0';
    }

    const ue4sslVersionForCheck = forceRedownload || !ue4ssValid ? '0' : manifest.ue4ssl;
    const secondVersionForCheck = forceRedownload || !secondValid ? '0' : manifest[secondManifestKey];

    await setMessage(t('Checking internal assets for updates...'));
    const secondAppType = game === 'rc' ? 'rc' : 'drg';
    let results;
    try {
        results = await checkUpdatesBatch([
            { currentVersion: ue4sslVersionForCheck, appType: 'ue4ssl', platform: PLATFORM, channel },
            { currentVersion: secondVersionForCheck, appType: secondAppType, platform: PLATFORM, channel },
        ]);
    } catch (error) {
        console.error('[InternalAssets] Failed to check update metadata:', error);
        throw new Error(t('Failed to check internal assets updates. Please check network and retry.'));
    }

    const needUe4ssl =
        forceRedownload ||
        !ue4ssValid ||
        (results[0].hasUpdate && results[0].latestVersion != null && results[0].md5 != null);
    const needSecond =
        forceRedownload ||
        !secondValid ||
        (results[1].hasUpdate && results[1].latestVersion != null && results[1].md5 != null);

    const downloadQueue: Array<{
        result: {
            latestVersion?: string;
            md5?: string;
            downloadUrl?: string;
            magnet?: string;
            torrentUrl?: string;
        };
        appType: string;
        destPath: string;
        manifestKey: 'ue4ssl' | 'drg' | 'rc';
    }> = [];

    if (needUe4ssl) {
        const r = results[0];
        if (!r.latestVersion || !r.md5) {
            throw new Error(t('Missing version or MD5 for {{name}}', { name: 'UE4SSL' }));
        }
        downloadQueue.push({ result: r, appType: 'ue4ssl', destPath: ue4ssZipPath, manifestKey: 'ue4ssl' });
    }

    if (needSecond) {
        const r = results[1];
        const label = game === 'rc' ? 'RC' : 'DRG';
        if (!r.latestVersion || !r.md5) {
            throw new Error(t('Missing version or MD5 for {{name}}', { name: label }));
        }
        downloadQueue.push({
            result: r,
            appType: secondAppType,
            destPath: secondZipPath,
            manifestKey: secondManifestKey,
        });
    }

    if (downloadQueue.length === 0) {
        await setMessage(t('Internal assets are up to date.'));
    } else {
        for (let i = 0; i < downloadQueue.length; i++) {
            if (checkCancelled()) throw new Error(t('Task Cancelled'));
            const item = downloadQueue[i];
            const label = `${item.appType.toUpperCase()}.zip`;
            const current = i + 1;
            const total = downloadQueue.length;

            await setMessage(t('Preparing download {{current}}/{{total}}: {{name}}', { current, total, name: label }));
            await downloadAndValidateZip(
                item.result,
                item.appType,
                item.destPath,
                cacheDir,
                item.manifestKey,
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
        await setMessage(t('Internal asset download completed.'));
    }

    updateProgress(100);

    // 最终校验：确认文件存在且为有效 ZIP
    const ue4ssOk = await exists(ue4ssZipPath) && await IntegrateApi.validateZipFile(ue4ssZipPath);
    const secondOk = await exists(secondZipPath) && await IntegrateApi.validateZipFile(secondZipPath);
    if (!ue4ssOk || !secondOk) {
        const missing = [(!ue4ssOk && ASSET_UE4SSL), (!secondOk && (game === 'rc' ? ASSET_RC : ASSET_DRG))].filter(Boolean);
        throw new Error(t('Internal assets missing after check: {{files}}', { files: missing.join(', ') }));
    }

    if (game === 'rc') {
        return { ue4ssZipPath, rcZipPath };
    }
    return { ue4ssZipPath, drgZipPath };
}

/**
 * Progress reporter shared by P2P and HTTP download paths.
 * Keeps the user-visible message format identical across both transports.
 */
function makeProgressReporter(
    fileName: string,
    current: number,
    total: number,
    setMessage: (msg: string, level?: 'info' | 'warning' | 'error') => Promise<void>,
    onProgress: (percent: number) => void,
    transport: 'P2P' | 'HTTP',
) {
    let lastReportedPercent = -1;
    let lastReportedAt = 0;
    return (downloaded: number, totalBytes: number, speedBytesPerSec: number, etaSecs: number) => {
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
        void setMessage(t('Downloading {{name}} ({{current}}/{{total}}) [{{transport}}] {{percent}}% - {{detail}}', {
            name: fileName,
            current,
            total,
            transport,
            percent,
            detail,
        }));
    };
}

/**
 * Try BitTorrent (librqbit + Web Seed) first. Returns true on success, false on failure or skip.
 *
 * Any error is logged and swallowed so that the caller can fall back to HTTP transparently.
 * MD5 is verified by the backend before resolving; on failure the file is deleted there as well.
 */
async function tryDownloadViaP2P(
    result: { md5?: string; magnet?: string; torrentUrl?: string },
    destPath: string,
    fileName: string,
    current: number,
    total: number,
    setMessage: (msg: string, level?: 'info' | 'warning' | 'error') => Promise<void>,
    onProgress: (percent: number) => void,
): Promise<boolean> {
    const source = result.magnet || result.torrentUrl;
    if (!source) return false;

    try {
        await setMessage(t('Downloading {{name}} ({{current}}/{{total}}) [P2P]...', {
            name: fileName,
            current,
            total,
        }));

        const onP2PProgress = makeProgressReporter(
            fileName,
            current,
            total,
            setMessage,
            onProgress,
            'P2P',
        );
        await DownloadApi.downloadViaP2P(
            source,
            destPath,
            { checksum: result.md5, firstPieceTimeoutSecs: 20 },
            onP2PProgress,
        );
        return true;
    } catch (error) {
        console.warn(`[InternalAssets] P2P failed for ${fileName}, falling back to HTTP:`, error);
        try { await remove(destPath); } catch (_) { /* best effort */ }
        return false;
    }
}

/** Download a ZIP asset with post-download validation and automatic retry */
async function downloadAndValidateZip(
    result: {
        latestVersion?: string;
        md5?: string;
        downloadUrl?: string;
        magnet?: string;
        torrentUrl?: string;
    },
    appType: string,
    destPath: string,
    cacheDir: string,
    manifestKey: 'ue4ssl' | 'drg' | 'rc',
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

    // 先尝试 P2P（BitTorrent + Web Seed）。成功后进入 ZIP 完整性校验，失败则静默回退 HTTP。
    // P2P 只尝试一次：失败后 HTTP 路径有自己的重试/回退逻辑，无需再叠加 P2P 重试。
    if (!checkCancelled()) {
        const p2pOk = await tryDownloadViaP2P(
            result,
            destPath,
            fileName,
            current,
            total,
            setMessage,
            onProgress,
        );
        if (p2pOk) {
            onProgress(100);
            if (await IntegrateApi.validateZipFile(destPath)) {
                await writeManifest(cacheDir, { [manifestKey]: result.latestVersion!, channel });
                await setMessage(t('Downloaded {{name}} successfully.', { name: fileName }));
                return;
            }
            console.warn(`[InternalAssets] P2P produced corrupted ZIP for ${fileName}; falling back to HTTP`);
            try { await remove(destPath); } catch (_) { /* best effort */ }
        }
    }

    for (let attempt = 0; attempt < MAX_DOWNLOAD_RETRIES; attempt++) {
        if (checkCancelled()) throw new Error(t('Task Cancelled'));
        let statusError = '';
        const attemptNumber = attempt + 1;

        if (attemptNumber > 1) {
            await setMessage(t('Retrying {{name}} ({{current}}/{{total}}), attempt {{n}}/{{max}}...', {
                name: fileName,
                current,
                total,
                n: attemptNumber,
                max: MAX_DOWNLOAD_RETRIES,
            }), 'warning');
            console.warn(`[InternalAssets] Retry ${attemptNumber}/${MAX_DOWNLOAD_RETRIES} for ${fileName}`);
        } else {
            await setMessage(t('Downloading {{name}} ({{current}}/{{total}})...', { name: fileName, current, total }));
        }

        const downloadUrl = result.downloadUrl
            ? getDownloadUrl(result.downloadUrl)
            : getReleaseDownloadUrl(result.latestVersion!, appType, PLATFORM, channel);

        const onHttpProgress = makeProgressReporter(
            fileName,
            current,
            total,
            setMessage,
            onProgress,
            'HTTP',
        );
        try {
            await DownloadApi.downloadFile(
                downloadUrl,
                destPath,
                { checksum: result.md5!, checksumType: 'md5' },
                onHttpProgress,
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
                await setMessage(t('Download failed for {{name}}: {{error}}. Waiting to retry...', {
                    name: fileName,
                    error: lastError,
                }), 'warning');
                await sleep(RETRY_BACKOFF_MS * attemptNumber);
                continue;
            }
            throw new Error(t('Failed to download valid {{name}} after {{n}} attempts', {
                name: fileName,
                n: MAX_DOWNLOAD_RETRIES,
            }) + `: ${lastError}`);
        }
        onProgress(100);

        if (await IntegrateApi.validateZipFile(destPath)) {
            await writeManifest(cacheDir, { [manifestKey]: result.latestVersion!, channel });
            await setMessage(t('Downloaded {{name}} successfully.', { name: fileName }));
            return;
        }

        lastError = statusError || t('Downloaded file is corrupted');
        console.error(`[InternalAssets] Downloaded ${fileName} is corrupted (attempt ${attemptNumber})`);
        try { await remove(destPath); } catch (_) { /* best effort */ }
        if (attemptNumber < MAX_DOWNLOAD_RETRIES) {
            await setMessage(t('Download failed for {{name}}: {{error}}. Waiting to retry...', {
                name: fileName,
                error: lastError,
            }), 'warning');
            await sleep(RETRY_BACKOFF_MS * attemptNumber);
        }
    }

    throw new Error(t('Failed to download valid {{name}} after {{n}} attempts', {
        name: fileName,
        n: MAX_DOWNLOAD_RETRIES,
    }) + (lastError ? `: ${lastError}` : ''));
}

/**
 * Get paths to internal asset zips. Returns null if any required file is missing.
 * - game 'drg': requires UE4SSL.zip + DRG.zip
 * - game 'rc': requires UE4SSL.zip + RC.zip
 */
export async function getInternalAssetPaths(game: InternalAssetGame = 'drg'): Promise<InternalAssetPaths | null> {
    const settings = await StorageAPI.getSettings();
    const channel = await settings.getReleaseChannel();
    const cacheDir = await CacheApi.getCacheDir();
    const { manifest } = await readManifest(cacheDir);
    if (manifest.channel !== channel) {
        return null;
    }
    const ue4ssZipPath = joinPath(cacheDir, ASSET_UE4SSL);
    const drgZipPath = joinPath(cacheDir, ASSET_DRG);
    const rcZipPath = joinPath(cacheDir, ASSET_RC);
    if (game === 'rc') {
        if ((await exists(ue4ssZipPath)) && (await exists(rcZipPath))) {
            return { ue4ssZipPath, rcZipPath };
        }
    } else {
        if ((await exists(ue4ssZipPath)) && (await exists(drgZipPath))) {
            return { ue4ssZipPath, drgZipPath };
        }
    }
    return null;
}
