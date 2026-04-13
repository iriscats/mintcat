import type { NetworkResolvedRoute } from './RequestTypes';

type LogContext = {
    requestId: string;
    service: string;
    method: string;
    route: NetworkResolvedRoute;
    attempt: number;
    headers?: Record<string, string>;
};

type SuccessContext = LogContext & {
    durationMs: number;
    status: number;
};

type FailureContext = LogContext & {
    durationMs?: number;
    error: unknown;
    status?: number;
    final?: boolean;
};

export class RequestLogger {
    private sanitizeHeaders(headers?: Record<string, string>): Record<string, string> | undefined {
        if (!headers) {
            return undefined;
        }

        const out: Record<string, string> = {};
        for (const [key, value] of Object.entries(headers)) {
            const lowerKey = key.toLowerCase();
            if (lowerKey === 'authorization' || lowerKey === 'cookie' || lowerKey === 'x-api-key') {
                out[key] = '[REDACTED]';
                continue;
            }
            out[key] = value;
        }
        return out;
    }

    private formatError(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        return String(error);
    }

    public logAttemptStart(ctx: LogContext): void {
        console.log('[NetworkClient] request:start', {
            requestId: ctx.requestId,
            service: ctx.service,
            method: ctx.method,
            attempt: ctx.attempt,
            routeKind: ctx.route.kind,
            proxyMode: ctx.route.proxyMode,
            originalUrl: ctx.route.originalUrl,
            resolvedUrl: ctx.route.resolvedUrl,
            headers: this.sanitizeHeaders(ctx.headers),
        });
    }

    public logAttemptSuccess(ctx: SuccessContext): void {
        console.log('[NetworkClient] request:success', {
            requestId: ctx.requestId,
            service: ctx.service,
            method: ctx.method,
            attempt: ctx.attempt,
            routeKind: ctx.route.kind,
            proxyMode: ctx.route.proxyMode,
            status: ctx.status,
            durationMs: ctx.durationMs,
            resolvedUrl: ctx.route.resolvedUrl,
        });
    }

    public logAttemptFailure(ctx: FailureContext): void {
        const log = ctx.final ? console.error : console.warn;
        log('[NetworkClient] request:failure', {
            requestId: ctx.requestId,
            service: ctx.service,
            method: ctx.method,
            attempt: ctx.attempt,
            routeKind: ctx.route.kind,
            proxyMode: ctx.route.proxyMode,
            status: ctx.status,
            durationMs: ctx.durationMs,
            final: ctx.final ?? false,
            resolvedUrl: ctx.route.resolvedUrl,
            error: this.formatError(ctx.error),
        });
    }
}

