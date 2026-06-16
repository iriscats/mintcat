import type { UpdateCheckItem, UpdateCheckManifestItem } from './types';
import { DEFAULT_RELEASE_CHANNEL } from './releaseChannel';

export function normalizeManifestKey(value: string | undefined | null): string {
    return (value ?? '').trim().toLowerCase();
}

/**
 * Compare semver-like versions. Returns > 0 when left is newer than right.
 */
export function compareVersion(left: string, right: string): number {
    const parse = (value: string) => value
        .split(/[.-]/)
        .map((part) => Number.parseInt(part, 10))
        .map((part) => (Number.isFinite(part) ? part : 0));
    const a = parse(left);
    const b = parse(right);
    const len = Math.max(a.length, b.length, 3);
    for (let i = 0; i < len; i++) {
        const diff = (a[i] ?? 0) - (b[i] ?? 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

export function getManifestItemDownloadPath(item: UpdateCheckManifestItem): string | undefined {
    return item.downloadUrl ?? item.url ?? item.path;
}

export function getManifestItemChecksum(item: UpdateCheckManifestItem): string | undefined {
    return item.sha256 ?? item.md5 ?? item.checksum;
}

export function matchesRequestedUpdateItem(
    manifestItem: UpdateCheckManifestItem,
    requestItem: UpdateCheckItem,
): boolean {
    const requestAppType = normalizeManifestKey(requestItem.appType ?? requestItem.name ?? requestItem.type);
    const manifestName = normalizeManifestKey(manifestItem.name);
    const manifestType = normalizeManifestKey(manifestItem.type);
    const manifestChannel = normalizeManifestKey(manifestItem.channel || DEFAULT_RELEASE_CHANNEL);
    const requestChannel = normalizeManifestKey(requestItem.channel || DEFAULT_RELEASE_CHANNEL);

    if (manifestChannel !== requestChannel) return false;
    if (!requestAppType) return false;
    return requestAppType === manifestName || requestAppType === manifestType;
}

export function matchesFrontendUpdate(item: UpdateCheckManifestItem, channel: string): boolean {
    const requestedChannel = normalizeManifestKey(channel || DEFAULT_RELEASE_CHANNEL);
    const name = normalizeManifestKey(item.name);
    const type = normalizeManifestKey(item.type);
    const itemChannel = normalizeManifestKey(item.channel || DEFAULT_RELEASE_CHANNEL);
    return itemChannel === requestedChannel && (name === 'mintcat-frontend' || (name === 'frontend' && type === 'frontend'));
}

export function matchesIntegratorRuntime(item: UpdateCheckManifestItem, channel: string): boolean {
    const requestedChannel = normalizeManifestKey(channel || DEFAULT_RELEASE_CHANNEL);
    const name = normalizeManifestKey(item.name);
    const type = normalizeManifestKey(item.type);
    const itemChannel = normalizeManifestKey(item.channel || DEFAULT_RELEASE_CHANNEL);
    return itemChannel === requestedChannel
        && (name === 'mintcat-integrator' || (name === 'integrator' && type === 'runtime'));
}

export function matchesProxyRuntime(item: UpdateCheckManifestItem): boolean {
    const name = normalizeManifestKey(item.name);
    const type = normalizeManifestKey(item.type);
    return name === 'mintcat-proxy'
        || (name === 'proxy' && (!type || type === 'runtime' || type === 'proxy'));
}

export function matchesManifestPlatform(
    item: UpdateCheckManifestItem,
    currentPlatform: string,
    currentArch: string,
): boolean {
    const itemPlatform = normalizeManifestKey(item.platform);
    const itemArch = normalizeManifestKey(item.arch);
    const platform = normalizeManifestKey(currentPlatform);
    const arch = normalizeManifestKey(currentArch);
    const platformMatched = !itemPlatform
        || itemPlatform === platform
        || (platform === 'macos' && ['darwin', 'osx'].includes(itemPlatform))
        || (platform === 'windows' && ['win32', 'win'].includes(itemPlatform));
    const archMatched = !itemArch || itemArch === arch || (arch === 'x86_64' && itemArch === 'amd64');
    return platformMatched && archMatched;
}
