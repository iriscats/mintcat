import { StorageAPI } from '@/storage';
import { NetworkApi } from '@/apis/NetworkApi';
import { NetworkRequestError } from '@/services/network';
import {
    MintCatApiUrls,
    MINTCAT_API_ORIGINS,
    type MintcatApiOriginId,
    normalizeMintcatApiOrigin,
    setMintcatApiResolvedOrigin,
} from './urls';

export type MintcatServerMode = 'auto' | MintcatApiOriginId | 'custom';

export const NETWORK_SERVER_MODE_KEY = 'network.server_mode';
/** 自动模式下上次探测选中的最优 origin */
export const NETWORK_SERVER_AUTO_ORIGIN_KEY = 'network.auto_best_origin';

export interface ProbeResult {
    /** 用于展示：内置节点 id；单点探测时初始化为 unknown */
    key: MintcatApiOriginId | 'unknown';
    origin: string;
    ok: boolean;
    latencyMs?: number;
    error?: string;
}

/**
 * 使用 release check 做真实探测，避免只 ping 成功但业务接口已异常的节点被误判为可用。
 */
export async function probeOrigin(origin: string, timeoutMs = 4000): Promise<ProbeResult> {
    const normalized = normalizeMintcatApiOrigin(origin);
    const url = buildReleaseProbeUrl(normalized);
    const started = performance.now();
    try {
        const result = await NetworkApi.request<unknown>({
            service: 'mintcat.routing.probeOrigin',
            url,
            method: 'GET',
            timeoutMs,
            proxyPolicy: 'direct',
            parseAs: 'json',
        });
        const response = result.response;
        const latencyMs = Math.round(performance.now() - started);
        if (!response.ok) {
            return { key: 'unknown', origin: normalized, ok: false, error: `HTTP ${response.status}` };
        }
        if (!isReleaseProbeResponse(result.data)) {
            return { key: 'unknown', origin: normalized, ok: false, error: 'Invalid release response' };
        }
        return { key: 'unknown', origin: normalized, ok: true, latencyMs };
    } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        const aborted = e instanceof NetworkRequestError
            ? e.code === 'timeout'
            : err.includes('abort') || err === 'AbortError';
        return {
            key: 'unknown',
            origin: normalized,
            ok: false,
            error: aborted ? 'timeout' : err,
        };
    }
}

function buildReleaseProbeUrl(origin: string): string {
    const params = new URLSearchParams({
        currentVersion: '0',
        appType: 'mintcat',
        platform: 'windows',
        channel: 'stable',
    });
    return `${MintCatApiUrls.releases.checkUpdate(origin)}?${params.toString()}`;
}

function isReleaseProbeResponse(value: unknown): value is { hasUpdate: boolean } {
    if (typeof value !== 'object' || value == null) {
        return false;
    }
    return typeof (value as { hasUpdate?: unknown }).hasUpdate === 'boolean';
}

/** 并行探测全部内置 API 节点 */
export async function probeAllOrigins(options?: { timeoutMs?: number }): Promise<ProbeResult[]> {
    const timeoutMs = options?.timeoutMs ?? 4000;

    const tasks: Promise<ProbeResult>[] = MINTCAT_API_ORIGINS.map(async (row) => {
        const r = await probeOrigin(row.origin, timeoutMs);
        return { ...r, key: row.id };
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

/** 在探测结果中选延迟最小的可达 origin；全部失败返回 null */
export function pickFastestReachableOrigin(results: ProbeResult[]): string | null {
    const ok = results.filter((r) => r.ok && r.latencyMs != null);
    if (ok.length === 0) {
        return null;
    }
    ok.sort((a, b) => (a.latencyMs ?? 0) - (b.latencyMs ?? 0));
    return ok[0].origin;
}

/** 自动模式下后台重新探测并更新缓存（供启动与设置页复用） */
export async function refreshAutoMintcatApiRoutingInBackground(): Promise<void> {
    try {
        const settings = await StorageAPI.getSettings();
        const mode = ((await settings.getValue(NETWORK_SERVER_MODE_KEY))?.trim() as MintcatServerMode) || 'auto';
        if (mode !== 'auto') {
            return;
        }
        const results = await probeAllOrigins();
        const best = pickFastestReachableOrigin(results);
        if (best) {
            setMintcatApiResolvedOrigin(best);
            await settings.setValue(NETWORK_SERVER_AUTO_ORIGIN_KEY, best);
        }
    } catch (e) {
        console.warn('[mintcat routing] Background API re-probe failed', e);
    }
}
