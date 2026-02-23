import { exists, readTextFile, writeFile } from '@tauri-apps/plugin-fs';
import { t } from 'i18next';
import { checkUpdatesBatch, getDownloadUrl, getReleaseDownloadUrl } from '@/apis/mintcat';
import { DownloadApi } from '@/apis/DownloadApi';
import { CacheApi } from '@/apis/CacheApi';

const ASSET_UE4SSL = 'UE4SSL.zip';
const ASSET_DRG = 'DRG.zip';
const ASSET_RC = 'RC.zip';
const PLATFORM = 'windows';
const CHANNEL = 'beta';
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

/**
 * Ensure internal asset zips exist in cache, downloading with MD5 check if missing or outdated.
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

    const ue4ssExists = await exists(ue4ssZipPath);
    const drgExists = await exists(drgZipPath);
    const rcExists = await exists(rcZipPath);

    const { manifest, valid: manifestValid } = await readManifest(cacheDir);

    // manifest 缺失或解析错误时强制重新下载并生成 manifest
    const forceRedownload = !manifestValid;

    // 缓存文件缺失时与 manifest 同步：避免 manifest 存在但 zip 被删后的不一致状态
    if (!forceRedownload && !ue4ssExists && manifest.ue4ssl !== '0') {
        await writeManifest(cacheDir, { ue4ssl: '0' });
        manifest.ue4ssl = '0';
    }
    if (!forceRedownload && game === 'rc') {
        if (!rcExists && manifest.rc !== '0') {
            await writeManifest(cacheDir, { rc: '0' });
            manifest.rc = '0';
        }
    } else if (!forceRedownload) {
        if (!drgExists && manifest.drg !== '0') {
            await writeManifest(cacheDir, { drg: '0' });
            manifest.drg = '0';
        }
    }

    // 若缓存文件缺失或 manifest 无效则用 '0' 参与检查，否则 API 可能不返回 latestVersion/md5 导致报错
    const ue4sslVersionForCheck = forceRedownload || !ue4ssExists ? '0' : manifest.ue4ssl;
    const secondVersionForCheck =
        forceRedownload || (game === 'rc' ? !rcExists : !drgExists)
            ? '0'
            : (game === 'rc' ? manifest.rc : manifest.drg);

    await setMessage(t('Checking internal assets for updates...'));
    const secondAppType = game === 'rc' ? 'rc' : 'drg';
    const results = await checkUpdatesBatch([
        { currentVersion: ue4sslVersionForCheck, appType: 'ue4ssl', platform: PLATFORM, channel: CHANNEL },
        { currentVersion: secondVersionForCheck, appType: secondAppType, platform: PLATFORM, channel: CHANNEL },
    ]);

    const needUe4ssl =
        forceRedownload ||
        !ue4ssExists ||
        (results[0].hasUpdate && results[0].latestVersion != null && results[0].md5 != null);
    const needSecond =
        forceRedownload ||
        (game === 'rc'
            ? (!rcExists || (results[1].hasUpdate && results[1].latestVersion != null && results[1].md5 != null))
            : (!drgExists || (results[1].hasUpdate && results[1].latestVersion != null && results[1].md5 != null)));

    if (needUe4ssl) {
        if (checkCancelled()) throw new Error('Task cancelled');
        const r = results[0];
        if (!r.latestVersion || !r.md5) throw new Error('Missing version or MD5 for UE4SSL');
        await setMessage(t('Downloading UE4SSL.zip...'));
        const ue4sslDownloadUrl = r.downloadUrl
            ? getDownloadUrl(r.downloadUrl)
            : getReleaseDownloadUrl(r.latestVersion, 'ue4ssl', PLATFORM, CHANNEL);
        await DownloadApi.downloadFile(
            ue4sslDownloadUrl,
            ue4ssZipPath,
            { checksum: r.md5, checksumType: 'md5' }
        );
        await writeManifest(cacheDir, { ue4ssl: r.latestVersion });
    }

    if (needSecond) {
        if (checkCancelled()) throw new Error('Task cancelled');
        const r = results[1];
        if (game === 'rc') {
            if (!r.latestVersion || !r.md5) throw new Error('Missing version or MD5 for RC');
            await setMessage(t('Downloading RC.zip...'));
        } else {
            if (!r.latestVersion || !r.md5) throw new Error('Missing version or MD5 for DRG');
            await setMessage(t('Downloading DRG.zip...'));
        }
        const downloadUrl = r.downloadUrl
            ? getDownloadUrl(r.downloadUrl)
            : getReleaseDownloadUrl(r.latestVersion, secondAppType, PLATFORM, CHANNEL);
        const destPath = game === 'rc' ? rcZipPath : drgZipPath;
        await DownloadApi.downloadFile(
            downloadUrl,
            destPath,
            { checksum: r.md5, checksumType: 'md5' }
        );
        await writeManifest(cacheDir, game === 'rc' ? { rc: r.latestVersion } : { drg: r.latestVersion });
    }

    updateProgress(100);

    // 再次确认所需缓存文件存在，防止 manifest 与磁盘不一致导致返回无效路径
    const ue4ssOk = await exists(ue4ssZipPath);
    const secondOk = game === 'rc' ? await exists(rcZipPath) : await exists(drgZipPath);
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
