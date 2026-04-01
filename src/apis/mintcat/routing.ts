import { StorageAPI } from '@/storage';
import {
    mintcatApiUrl,
    MintCatApiPaths,
    MINTCAT_API_ORIGINS,
    normalizeMintcatApiOrigin,
    setMintcatApiResolvedOrigin,
} from './urls';

export type MintcatServerMode = 'auto' | 'zh' | 'global' | 'custom';

export const NETWORK_SERVER_MODE_KEY = 'network.server_mode';
/** 自动模式下上次探测选中的最优 origin */
export const NETWORK_SERVER_AUTO_ORIGIN_KEY = 'network.auto_best_origin';

export interface ProbeResult {
    /** 用于展示：zh | global */
    key: string;
    origin: string;
    ok: boolean;
    latencyMs?: number;
    error?: string;
}

function withTimeoutSignal(timeoutMs: number): { signal: AbortSignal; cancel: () => void } {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    return {
        signal: controller.signal,
        cancel: () => clearTimeout(id),
    };
}

/**
 * GET /ping on a single API origin.
 */
export async function probeOrigin(origin: string, timeoutMs = 4000): Promise<ProbeResult> {
    const normalized = normalizeMintcatApiOrigin(origin);
    const url = mintcatApiUrl(normalized, MintCatApiPaths.ping);
    const { signal, cancel } = withTimeoutSignal(timeoutMs);
    const started = performance.now();
    try {
        const response = await fetch(url, { method: 'GET', signal });
        const latencyMs = Math.round(performance.now() - started);
        if (!response.ok) {
            return { key: 'unknown', origin: normalized, ok: false, error: `HTTP ${response.status}` };
        }
        return { key: 'unknown', origin: normalized, ok: true, latencyMs };
    } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        const aborted = err.includes('abort') || err === 'AbortError';
        return {
            key: 'unknown',
            origin: normalized,
            ok: false,
            error: aborted ? 'timeout' : err,
        };
    } finally {
        cancel();
    }
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
