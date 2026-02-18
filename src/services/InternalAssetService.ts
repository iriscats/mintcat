import { invoke } from '@tauri-apps/api/core';
import { exists, readTextFile, writeFile } from '@tauri-apps/plugin-fs';
import { t } from 'i18next';
import { checkUpdatesBatch, getDownloadUrl, getReleaseDownloadUrl } from '@/apis/mintcat';
import { DownloadApi } from '@/apis/DownloadApi';

const ASSET_UE4SSL = 'UE4SSL.zip';
const ASSET_DRG = 'DRG.zip';
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
}

export interface InternalAssetPaths {
    ue4ssZipPath: string;
    drgZipPath: string;
}

async function readManifest(cacheDir: string): Promise<{ ue4ssl: string; drg: string }> {
    const path = joinPath(cacheDir, MANIFEST_FILENAME);
    try {
        if (await exists(path)) {
            const content = await readTextFile(path);
            const data = JSON.parse(content) as { ue4ssl?: string; drg?: string };
            return { ue4ssl: data.ue4ssl ?? '0', drg: data.drg ?? '0' };
        }
    } catch (_) {
        // ignore
    }
    return { ue4ssl: '0', drg: '0' };
}

async function writeManifest(cacheDir: string, ue4sslVersion: string, drgVersion: string): Promise<void> {
    const path = joinPath(cacheDir, MANIFEST_FILENAME);
    const content = JSON.stringify({ ue4ssl: ue4sslVersion, drg: drgVersion });
    const bytes = new TextEncoder().encode(content);
    await writeFile(path, bytes);
}

/**
 * Ensure UE4SSL.zip and DRG.zip exist in asset cache, downloading with MD5 check if missing or outdated.
 * Returns paths to both zips. Used by CheckModUpdateTask and ModInstallTask.
 */
export async function ensureInternalAssets(
    options?: EnsureInternalAssetsOptions
): Promise<InternalAssetPaths> {
    const opts = options ?? {};
    const setStep = opts.setStep ?? (async () => {});
    const setMessage = opts.setMessage ?? (async () => {});
    const updateProgress = opts.updateProgress ?? (() => {});
    const checkCancelled = opts.checkCancelled ?? (() => false);

    const cacheDir = await invoke<string>('get_asset_cache_dir');
    const ue4ssZipPath = joinPath(cacheDir, ASSET_UE4SSL);
    const drgZipPath = joinPath(cacheDir, ASSET_DRG);

    const ue4ssExists = await exists(ue4ssZipPath);
    const drgExists = await exists(drgZipPath);

    const manifest = await readManifest(cacheDir);

    await setMessage(t('Checking internal assets for updates...'));
    const results = await checkUpdatesBatch([
        { currentVersion: manifest.ue4ssl, appType: 'ue4ssl', platform: PLATFORM, channel: CHANNEL },
        { currentVersion: manifest.drg, appType: 'drg', platform: PLATFORM, channel: CHANNEL },
    ]);

    console.log(results);
    const needUe4ssl = !ue4ssExists || (results[0].hasUpdate && results[0].latestVersion != null && results[0].md5 != null);
    const needDrg = !drgExists || (results[1].hasUpdate && results[1].latestVersion != null && results[1].md5 != null);

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
        await writeManifest(cacheDir, r.latestVersion, manifest.drg);
    }

    if (needDrg) {
        if (checkCancelled()) throw new Error('Task cancelled');
        const r = results[1];
        if (!r.latestVersion || !r.md5) throw new Error('Missing version or MD5 for DRG');
        await setMessage(t('Downloading DRG.zip...'));
        const drgDownloadUrl = r.downloadUrl
            ? getDownloadUrl(r.downloadUrl)
            : getReleaseDownloadUrl(r.latestVersion, 'drg', PLATFORM, CHANNEL);
        await DownloadApi.downloadFile(
            drgDownloadUrl,
            drgZipPath,
            { checksum: r.md5, checksumType: 'md5' }
        );
        await writeManifest(cacheDir, manifest.ue4ssl, r.latestVersion);
    }

    updateProgress(100);
    return { ue4ssZipPath, drgZipPath };
}

/**
 * Get paths to internal asset zips. Returns null for any missing file.
 */
export async function getInternalAssetPaths(): Promise<InternalAssetPaths | null> {
    const cacheDir = await invoke<string>('get_asset_cache_dir');
    const ue4ssZipPath = joinPath(cacheDir, ASSET_UE4SSL);
    const drgZipPath = joinPath(cacheDir, ASSET_DRG);
    if ((await exists(ue4ssZipPath)) && (await exists(drgZipPath))) {
        return { ue4ssZipPath, drgZipPath };
    }
    return null;
}
