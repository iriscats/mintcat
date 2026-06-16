import {arch, platform} from '@tauri-apps/plugin-os';
import {listen, type UnlistenFn} from '@tauri-apps/api/event';
import {
    fetchUpdateManifest,
    getManifestItemDownloadPath,
    getDownloadUrl,
    matchesManifestPlatform,
    matchesProxyRuntime,
    normalizeManifestKey,
    type UpdateCheckManifestItem,
} from '@/apis/mintcat';
import {StorageAPI} from '@/storage';
import {BackendRuntimeApi} from '@/apis/BackendRuntimeApi';

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

export async function findProxyRuntimeManifest(forceRefresh = false): Promise<UpdateCheckManifestItem | undefined> {
    const settings = await StorageAPI.getSettings();
    const releaseChannel = await settings.getReleaseChannel();
    const manifest = await fetchUpdateManifest(undefined, forceRefresh);
    const currentPlatform = normalizeManifestKey(await platform());
    const currentArch = normalizeManifestKey(await arch());

    const candidates = manifest.filter((item) => (
        matchesManifestPlatform(item, currentPlatform, currentArch)
        && matchesProxyRuntime(item)
    ));
    const requestedChannel = normalizeManifestKey(releaseChannel);
    return candidates.find((item) => normalizeManifestKey(item.channel) === requestedChannel)
        ?? candidates[0];
}

export async function installProxyRuntimeFromManifest(item: UpdateCheckManifestItem): Promise<ProxyRuntimeStatus> {
    const url = getManifestItemDownloadPath(item);
    if (!url) {
        throw new Error('proxy runtime download url is missing');
    }
    if (!item.md5) {
        throw new Error('proxy runtime md5 is missing');
    }

    return BackendRuntimeApi.invoke<ProxyRuntimeStatus>('install_proxy_runtime_from_manifest', {
        version: item.latestVersion,
        url: getDownloadUrl(url),
        md5: item.md5,
        signature: item.signature,
        minAppVersion: item.minAppVersion,
        maxAppVersion: item.maxAppVersion,
    });
}

export function getProxyRuntimeStatus(): Promise<ProxyRuntimeStatus> {
    return BackendRuntimeApi.invoke<ProxyRuntimeStatus>('get_proxy_runtime_status');
}

export function startProxyRuntime(options: StartProxyRuntimeOptions = {}): Promise<ProxyRuntimeStatus> {
    return BackendRuntimeApi.invoke<ProxyRuntimeStatus>('start_proxy_runtime', {
        port: options.port ?? 443,
        offline: options.offline ?? false,
        bind: options.bind ?? '0.0.0.0',
    });
}

export function stopProxyRuntime(): Promise<ProxyRuntimeStatus> {
    return BackendRuntimeApi.invoke<ProxyRuntimeStatus>('stop_proxy_runtime');
}

export function installProxyCert(): Promise<ProxyRuntimeStatus> {
    return BackendRuntimeApi.invoke<ProxyRuntimeStatus>('install_proxy_cert');
}

export function listenProxyRuntimeLog(callback: (event: ProxyRuntimeLogEvent) => void): Promise<UnlistenFn> {
    return listen<ProxyRuntimeLogEvent>('proxy-runtime-log', ({payload}) => callback(payload));
}

export function listenProxyRuntimeState(callback: (status: ProxyRuntimeStatus) => void): Promise<UnlistenFn> {
    return listen<ProxyRuntimeStateEvent>('proxy-runtime-state', ({payload}) => callback(payload.status));
}
