import {invoke} from '@tauri-apps/api/core';
import {arch, platform} from '@tauri-apps/plugin-os';
import {listen, type UnlistenFn} from '@tauri-apps/api/event';
import {
    fetchUpdateManifest,
    getDownloadUrl,
    type UpdateCheckManifestItem,
} from '@/apis/mintcat';
import {StorageAPI} from '@/storage';

export interface ProxyRuntimeStatus {
    activeVersion?: string | null;
    previousVersion?: string | null;
    lastFailedVersion?: string | null;
    installed: boolean;
    running: boolean;
    pid?: number | null;
    startedAt?: number | null;
    hasCertInstalled: boolean;
    logPath?: string | null;
}

export interface StartProxyRuntimeOptions {
    port?: number;
    offline?: boolean;
    bind?: string;
}

export interface ProxyRuntimeLogEvent {
    line: string;
}

export interface ProxyRuntimeStateEvent {
    status: ProxyRuntimeStatus;
}

function normalize(value?: string | null): string {
    return (value ?? '').trim().toLowerCase();
}

function matchesCurrentPlatform(item: UpdateCheckManifestItem, currentPlatform: string, currentArch: string): boolean {
    const itemPlatform = normalize(item.platform);
    const itemArch = normalize(item.arch);
    const platformMatched = !itemPlatform
        || itemPlatform === currentPlatform
        || (currentPlatform === 'macos' && ['darwin', 'osx'].includes(itemPlatform))
        || (currentPlatform === 'windows' && ['win32', 'win'].includes(itemPlatform));
    const archMatched = !itemArch || itemArch === currentArch || (currentArch === 'x86_64' && itemArch === 'amd64');
    return platformMatched && archMatched;
}

function matchesProxyRuntime(item: UpdateCheckManifestItem): boolean {
    const name = normalize(item.name);
    const type = normalize(item.type);
    return name === 'mintcat-proxy'
        || (name === 'proxy' && (!type || type === 'runtime' || type === 'proxy'));
}

export async function findProxyRuntimeManifest(forceRefresh = false): Promise<UpdateCheckManifestItem | undefined> {
    const settings = await StorageAPI.getSettings();
    const releaseChannel = await settings.getReleaseChannel();
    const manifest = await fetchUpdateManifest(undefined, forceRefresh);
    const currentPlatform = normalize(await platform());
    const currentArch = normalize(await arch());

    const candidates = manifest.filter((item) => (
        matchesCurrentPlatform(item, currentPlatform, currentArch)
        && matchesProxyRuntime(item)
    ));
    const requestedChannel = normalize(releaseChannel);
    return candidates.find((item) => normalize(item.channel) === requestedChannel)
        ?? candidates[0];
}

export async function installProxyRuntimeFromManifest(item: UpdateCheckManifestItem): Promise<ProxyRuntimeStatus> {
    const url = item.downloadUrl ?? item.url ?? item.path;
    if (!url) {
        throw new Error('proxy runtime download url is missing');
    }
    if (!item.md5) {
        throw new Error('proxy runtime md5 is missing');
    }

    return invoke<ProxyRuntimeStatus>('install_proxy_runtime_from_manifest', {
        manifest: {
            version: item.latestVersion,
            url: getDownloadUrl(url),
            md5: item.md5,
            signature: item.signature,
            minAppVersion: item.minAppVersion,
            maxAppVersion: item.maxAppVersion,
        },
    });
}

export function getProxyRuntimeStatus(): Promise<ProxyRuntimeStatus> {
    return invoke<ProxyRuntimeStatus>('get_proxy_runtime_status');
}

export function startProxyRuntime(options: StartProxyRuntimeOptions = {}): Promise<ProxyRuntimeStatus> {
    return invoke<ProxyRuntimeStatus>('start_proxy_runtime', {
        options: {
            port: options.port ?? 443,
            offline: options.offline ?? false,
            bind: options.bind ?? '0.0.0.0',
        },
    });
}

export function stopProxyRuntime(): Promise<ProxyRuntimeStatus> {
    return invoke<ProxyRuntimeStatus>('stop_proxy_runtime');
}

export function installProxyCert(): Promise<ProxyRuntimeStatus> {
    return invoke<ProxyRuntimeStatus>('install_proxy_cert');
}

export function listenProxyRuntimeLog(callback: (event: ProxyRuntimeLogEvent) => void): Promise<UnlistenFn> {
    return listen<ProxyRuntimeLogEvent>('proxy-runtime-log', ({payload}) => callback(payload));
}

export function listenProxyRuntimeState(callback: (status: ProxyRuntimeStatus) => void): Promise<UnlistenFn> {
    return listen<ProxyRuntimeStateEvent>('proxy-runtime-state', ({payload}) => callback(payload.status));
}
