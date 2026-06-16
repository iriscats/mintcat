import { StorageAPI } from '@/storage';
import {
    getDefaultMintcatApiOrigin,
    setMintcatApiResolvedOrigin,
} from './urls';
import {
    MINTCAT_RELEASE_ORIGINS,
    getMintcatReleaseOriginByPresetId,
    getMintcatUpdateManifestLanguageFallback,
    isMintcatReleaseOriginId,
    type MintcatReleaseOriginId,
    prefetchUpdateManifest,
    setMintcatUpdateManifestResolvedUrl,
} from './release';

export type MintcatServerMode = 'auto' | MintcatReleaseOriginId | 'custom';
export type ProbeResultKey = MintcatReleaseOriginId | 'unknown';

export const NETWORK_SERVER_MODE_KEY = 'network.server_mode';
/** 自动模式下上次探测选中的最优 release manifest URL */
export const NETWORK_SERVER_AUTO_ORIGIN_KEY = 'network.auto_best_origin';

export interface ProbeResult {
    /** 用于展示：内置节点 id；单点探测时初始化为 unknown */
    key: ProbeResultKey;
    origin: string;
    ok: boolean;
    latencyMs?: number;
    error?: string;
    labelKey?: string;
}

export interface ApplyMintcatApiRoutingOptions {
    cachedProbeTimeoutMs?: number;
    refreshInBackground?: boolean;
    logPrefix?: string;
}

/**
 * @deprecated Use probeUpdateManifest. This setting now routes release resources, not API servers.
 */
export async function probeOrigin(origin: string, timeoutMs = 4000): Promise<ProbeResult> {
    return probeUpdateManifest(origin, timeoutMs);
}

/**
 * 使用静态 update.json 探测下载/更新节点，供设置页“测试连接”展示。
 */
export async function probeUpdateManifest(origin: string, timeoutMs = 4000): Promise<ProbeResult> {
    const normalized = origin.trim();
    const started = performance.now();
    try {
        const manifest = await withTimeout(
            prefetchUpdateManifest(normalized),
            timeoutMs,
        );
        const latencyMs = Math.round(performance.now() - started);
        if (!Array.isArray(manifest)) {
            return { key: 'unknown', origin: normalized, ok: false, error: 'Invalid update manifest response' };
        }
        return { key: 'unknown', origin: normalized, ok: true, latencyMs };
    } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        const aborted = err === 'timeout' || err.includes('abort') || err === 'AbortError';
        return {
            key: 'unknown',
            origin: normalized,
            ok: false,
            error: aborted ? 'timeout' : err,
        };
    }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error('timeout')), timeoutMs);
        promise.then(
            (value) => {
                window.clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                window.clearTimeout(timer);
                reject(error);
            },
        );
    });
}

/** @deprecated Use probeAllUpdateManifests. */
export async function probeAllOrigins(options?: { timeoutMs?: number }): Promise<ProbeResult[]> {
    return probeAllUpdateManifests(options);
}

/** 并行探测全部更新清单节点（设置页测试连接使用） */
export async function probeAllUpdateManifests(options?: { timeoutMs?: number }): Promise<ProbeResult[]> {
    const timeoutMs = options?.timeoutMs ?? 4000;

    const tasks: Promise<ProbeResult>[] = MINTCAT_RELEASE_ORIGINS.map(async (row) => {
        const r = await probeUpdateManifest(row.manifestUrl, timeoutMs);
        return { ...r, key: row.id, labelKey: row.labelKey };
    });

    const settled = await Promise.allSettled(tasks);
    const out: ProbeResult[] = [];
    for (const s of settled) {
        if (s.status === 'fulfilled') {
            out.push(s.value);
        }
    }
    return out;
}

function refreshAutoRoutingIfNeeded(refreshInBackground = true): void {
    if (refreshInBackground) {
        void refreshAutoMintcatApiRoutingInBackground();
    }
}

/**
 * 根据设置解析 release 资源源站（手动线路 / 自动探测），并写入运行时 update manifest URL。
 * MintCat 后端 API 始终使用 urls.ts 中的默认 API 源站。
 */
export async function applyMintcatApiRoutingFromSettings(
    options: ApplyMintcatApiRoutingOptions = {},
): Promise<string> {
    const settings = await StorageAPI.getSettings();
    const modeRaw = await settings.getValue(NETWORK_SERVER_MODE_KEY);
    const mode = ((modeRaw?.trim() as MintcatServerMode) || 'auto');
    setMintcatApiResolvedOrigin(getDefaultMintcatApiOrigin());

    if (isMintcatReleaseOriginId(mode)) {
        const manifestUrl = getMintcatReleaseOriginByPresetId(mode);
        setMintcatUpdateManifestResolvedUrl(manifestUrl);
        return manifestUrl;
    }

    const autoCached = (await settings.getValue(NETWORK_SERVER_AUTO_ORIGIN_KEY))?.trim() ?? '';
    if (autoCached) {
        const probe = await probeUpdateManifest(autoCached, options.cachedProbeTimeoutMs ?? 1500);
        if (probe.ok) {
            setMintcatUpdateManifestResolvedUrl(autoCached);
            refreshAutoRoutingIfNeeded(options.refreshInBackground);
            return autoCached;
        }
        console.warn(
            `${options.logPrefix ?? '[mintcat routing]'} Cached release origin failed validation:`,
            autoCached,
            probe.error,
        );
    }

    const fallback = getMintcatUpdateManifestLanguageFallback();
    setMintcatUpdateManifestResolvedUrl(fallback);
    refreshAutoRoutingIfNeeded(options.refreshInBackground);
    return fallback;
}

/** 在探测结果中选延迟最小的可达 release manifest URL；全部失败返回 null */
export function pickFastestReachableOrigin(results: ProbeResult[]): string | null {
    const ok = results.filter((r) => r.ok && r.latencyMs != null);
    if (ok.length === 0) {
        return null;
    }
    ok.sort((a, b) => (a.latencyMs ?? 0) - (b.latencyMs ?? 0));
    return ok[0].origin;
}

/** 自动模式下后台重新探测 release 节点并更新缓存（供启动与设置页复用） */
export async function refreshAutoMintcatApiRoutingInBackground(): Promise<void> {
    try {
        const settings = await StorageAPI.getSettings();
        const mode = ((await settings.getValue(NETWORK_SERVER_MODE_KEY))?.trim() as MintcatServerMode) || 'auto';
        if (mode !== 'auto') {
            return;
        }
        const results = await probeAllUpdateManifests();
        const best = pickFastestReachableOrigin(results);
        if (best) {
            setMintcatUpdateManifestResolvedUrl(best);
            await settings.setValue(NETWORK_SERVER_AUTO_ORIGIN_KEY, best);
        }
    } catch (e) {
        console.warn('[mintcat routing] Background API re-probe failed', e);
    }
}
