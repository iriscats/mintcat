import { exists, readTextFile, writeFile, remove } from '@tauri-apps/plugin-fs';
import { t } from 'i18next';
import { checkUpdatesBatch, getDownloadUrl, getReleaseDownloadUrl } from '@/apis/mintcat';
import { DownloadApi } from '@/apis/DownloadApi';
import { CacheApi } from '@/apis/CacheApi';
import { IntegrateApi } from '@/apis/IntegrateApi';

const ASSET_UE4SSL = 'UE4SSL.zip';
const ASSET_DRG = 'DRG.zip';
const ASSET_RC = 'RC.zip';
const PLATFORM = 'windows';
const CHANNEL = 'stable';
const MANIFEST_FILENAME = 'assets_manifest.json';

function joinPath(cacheDir: string, name: string): string {
    const sep = cacheDir.includes('\\') ? '\\' : '/';
    const norm = cacheDir.replace(/[/\\]+$/, '');
    return `${norm}${sep}${name}`;
}

export interface EnsureInternalAssetsOptions {
    setStep?: (name: string, current: number, total: number) => Promise<void>;
    setMessage?: (msg: string) => Promise<void>;
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
}

const DEFAULT_MANIFEST: AssetManifest = { ue4ssl: '0', drg: '0', rc: '0' };

/** 读取 manifest；若文件缺失或解析错误则返回默认值并标记 invalid */
async function readManifest(cacheDir: string): Promise<{ manifest: AssetManifest; valid: boolean }> {
    const path = joinPath(cacheDir, MANIFEST_FILENAME);
    try {
        if (await exists(path)) {
            const content = await readTextFile(path);
            const data = JSON.parse(content) as { ue4ssl?: string; drg?: string; rc?: string };
            return {
                manifest: {
                    ue4ssl: data.ue4ssl ?? '0',
                    drg: data.drg ?? '0',
                    rc: data.rc ?? '0',
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
    manifestKey: keyof AssetManifest,
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

const MAX_DOWNLOAD_RETRIES = 2;

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

    const cacheDir = await CacheApi.getCacheDir();
    const ue4ssZipPath = joinPath(cacheDir, ASSET_UE4SSL);
    const drgZipPath = joinPath(cacheDir, ASSET_DRG);
    const rcZipPath = joinPath(cacheDir, ASSET_RC);

    const { manifest, valid: manifestValid } = await readManifest(cacheDir);

    // manifest 缺失或解析错误时强制重新下载并生成 manifest
    const forceRedownload = !manifestValid;

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
    const results = await checkUpdatesBatch([
        { currentVersion: ue4sslVersionForCheck, appType: 'ue4ssl', platform: PLATFORM, channel: CHANNEL },
        { currentVersion: secondVersionForCheck, appType: secondAppType, platform: PLATFORM, channel: CHANNEL },
    ]);

    const needUe4ssl =
        forceRedownload ||
        !ue4ssValid ||
        (results[0].hasUpdate && results[0].latestVersion != null && results[0].md5 != null);
    const needSecond =
        forceRedownload ||
        !secondValid ||
        (results[1].hasUpdate && results[1].latestVersion != null && results[1].md5 != null);

    if (needUe4ssl) {
        if (checkCancelled()) throw new Error('Task cancelled');
        const r = results[0];
        if (!r.latestVersion || !r.md5) throw new Error('Missing version or MD5 for UE4SSL');
        await downloadAndValidateZip(
            r, 'ue4ssl', ue4ssZipPath, cacheDir, 'ue4ssl', setMessage, checkCancelled,
        );
    }

    if (needSecond) {
        if (checkCancelled()) throw new Error('Task cancelled');
        const r = results[1];
        const label = game === 'rc' ? 'RC' : 'DRG';
        if (!r.latestVersion || !r.md5) throw new Error(`Missing version or MD5 for ${label}`);
        await downloadAndValidateZip(
            r, secondAppType, secondZipPath, cacheDir, secondManifestKey, setMessage, checkCancelled,
        );
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

/** Download a ZIP asset with post-download validation and automatic retry */
async function downloadAndValidateZip(
    result: { latestVersion?: string; md5?: string; downloadUrl?: string },
    appType: string,
    destPath: string,
    cacheDir: string,
    manifestKey: keyof AssetManifest,
    setMessage: (msg: string) => Promise<void>,
    checkCancelled: () => boolean,
): Promise<void> {
    const label = appType.toUpperCase();

    for (let attempt = 0; attempt < MAX_DOWNLOAD_RETRIES; attempt++) {
        if (checkCancelled()) throw new Error('Task cancelled');

        if (attempt > 0) {
            await setMessage(t('Retrying download {{name}} (attempt {{n}})...', { name: `${label}.zip`, n: attempt + 1 }));
            console.warn(`[InternalAssets] Retry ${attempt + 1} for ${label}.zip`);
        } else {
            await setMessage(t(`Downloading ${label}.zip...`));
        }

        const downloadUrl = result.downloadUrl
            ? getDownloadUrl(result.downloadUrl)
            : getReleaseDownloadUrl(result.latestVersion!, appType, PLATFORM, CHANNEL);

        await DownloadApi.downloadFile(downloadUrl, destPath, { checksum: result.md5!, checksumType: 'md5' });

        if (await IntegrateApi.validateZipFile(destPath)) {
            await writeManifest(cacheDir, { [manifestKey]: result.latestVersion! });
            return;
        }

        console.error(`[InternalAssets] Downloaded ${label}.zip is corrupted (attempt ${attempt + 1})`);
        try { await remove(destPath); } catch (_) { /* best effort */ }
    }

    throw new Error(t('Failed to download valid {{name}} after {{n}} attempts', {
        name: `${label}.zip`,
        n: MAX_DOWNLOAD_RETRIES,
    }));
}

/**
 * Get paths to internal asset zips. Returns null if any required file is missing.
 * - game 'drg': requires UE4SSL.zip + DRG.zip
 * - game 'rc': requires UE4SSL.zip + RC.zip
 */
export async function getInternalAssetPaths(game: InternalAssetGame = 'drg'): Promise<InternalAssetPaths | null> {
    const cacheDir = await CacheApi.getCacheDir();
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
