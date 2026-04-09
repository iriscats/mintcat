import { AuthResolver } from './AuthResolver';
import { RequestLogger } from './RequestLogger';
import { RoutePolicy } from './RoutePolicy';
import {
    DEFAULT_NETWORK_MAX_TRY,
    DEFAULT_NETWORK_RETRY_DELAY_MS,
    DEFAULT_NETWORK_TIMEOUT_MS,
    type NetworkParseAs,
    NetworkRequestError,
    type NetworkRequestConfig,
    type NetworkResolvedRoute,
    type NetworkResponse,
    type NetworkRoutePlan,
} from './RequestTypes';

function nowMs(): number {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return performance.now();
    }
    return Date.now();
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildRequestId(service: string): string {
    return `${service}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isAbortError(error: unknown): boolean {
    if (error instanceof DOMException && error.name === 'AbortError') {
        return true;
    }
    if (error instanceof Error) {
        return error.name === 'AbortError' || /abort/i.test(error.message);
    }
    return false;
}

export class NetworkClient {
    public constructor(
        private readonly authResolver: AuthResolver = new AuthResolver(),
        private readonly routePolicy: RoutePolicy = new RoutePolicy(),
        private readonly requestLogger: RequestLogger = new RequestLogger(),
    ) {}

    public async resolveRoutePlan(
        url: string,
        config?: Pick<NetworkRequestConfig, 'proxyPolicy'>,
    ): Promise<NetworkRoutePlan> {
        return await this.routePolicy.resolveUrl(url, { proxyPolicy: config?.proxyPolicy });
    }

    private async fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            return await fetch(url, {
                ...init,
                signal: controller.signal,
            });
        } finally {
            clearTimeout(timeoutId);
        }
    }

    private createTransportError(
        error: unknown,
        config: NetworkRequestConfig,
        route: NetworkResolvedRoute,
        requestId: string,
        durationMs: number,
    ): NetworkRequestError {
        const code = isAbortError(error) ? 'timeout' : 'network';
        const message = error instanceof Error ? error.message : String(error);
        return new NetworkRequestError(message || 'Network request failed', {
            code,
            requestId,
            service: config.service,
            route,
            durationMs,
            cause: error,
        });
    }

    private createHttpError(
        response: Response,
        config: NetworkRequestConfig,
        route: NetworkResolvedRoute,
        requestId: string,
        durationMs: number,
    ): NetworkRequestError {
        return new NetworkRequestError(`HTTP ${response.status}`, {
            code: 'http',
            requestId,
            service: config.service,
            route,
            durationMs,
            status: response.status,
            response,
        });
    }

    private async parseResponse<T>(
        parseAs: NetworkParseAs | undefined,
        response: Response,
        config: NetworkRequestConfig,
        route: NetworkResolvedRoute,
        requestId: string,
        durationMs: number,
    ): Promise<T> {
        if (!parseAs || parseAs === 'response') {
            return response as T;
        }

        try {
            if (parseAs === 'text') {
                return await response.text() as T;
            }

            if (parseAs === 'bytes') {
                return new Uint8Array(await response.arrayBuffer()) as T;
            }

            const text = await response.text();
            if (!text) {
                return undefined as T;
            }
            return JSON.parse(text) as T;
        } catch (error) {
            throw new NetworkRequestError('Failed to parse response body', {
                code: 'parse',
                requestId,
                service: config.service,
                route,
                durationMs,
                status: response.status,
                response,
                cause: error,
            });
        }
    }

    private async executeRoute(
        config: NetworkRequestConfig,
        route: NetworkResolvedRoute,
        headers: Record<string, string>,
        requestId: string,
    ): Promise<{ response: Response; durationMs: number }> {
        const method = (config.method ?? 'GET').toUpperCase();
        const timeoutMs = config.timeoutMs ?? DEFAULT_NETWORK_TIMEOUT_MS;
        const maxTry = config.retry?.maxTry ?? DEFAULT_NETWORK_MAX_TRY;
        const delayMs = config.retry?.delayMs ?? DEFAULT_NETWORK_RETRY_DELAY_MS;

        for (let attempt = 1; attempt <= maxTry; attempt++) {
            this.requestLogger.logAttemptStart({
                requestId,
                service: config.service,
                method,
                attempt,
                route,
                headers,
            });

            const started = nowMs();
            try {
                const response = await this.fetchWithTimeout(route.resolvedUrl, {
                    method,
                    headers,
                    body: config.body,
                }, timeoutMs);
                const durationMs = Math.round(nowMs() - started);

                if (config.throwOnHttpError && !response.ok) {
                    const error = this.createHttpError(response, config, route, requestId, durationMs);
                    this.requestLogger.logAttemptFailure({
                        requestId,
                        service: config.service,
                        method,
                        attempt,
                        route,
                        durationMs,
                        status: response.status,
                        error,
                        final: true,
                        headers,
                    });
                    throw error;
                }

                this.requestLogger.logAttemptSuccess({
                    requestId,
                    service: config.service,
                    method,
                    attempt,
                    route,
                    durationMs,
                    status: response.status,
                    headers,
                });
                return { response, durationMs };
            } catch (error) {
                if (error instanceof NetworkRequestError) {
                    throw error;
                }

                const durationMs = Math.round(nowMs() - started);
                const requestError = this.createTransportError(error, config, route, requestId, durationMs);
                this.requestLogger.logAttemptFailure({
                    requestId,
                    service: config.service,
                    method,
                    attempt,
                    route,
                    durationMs,
                    error: requestError,
                    final: attempt >= maxTry,
                    headers,
                });

                if (attempt >= maxTry) {
                    throw requestError;
                }

                if (delayMs > 0) {
                    await sleep(delayMs);
                }
            }
        }

        throw new NetworkRequestError('Network request exhausted retries', {
            code: 'network',
            requestId,
            service: config.service,
            route,
        });
    }

    public async request<T = Response>(config: NetworkRequestConfig): Promise<NetworkResponse<T>> {
        const requestId = buildRequestId(config.service);
        const authHeaders = await this.authResolver.resolveHeaders(config.authPolicy ?? 'none');
        const headers = {
            ...authHeaders,
            ...(config.headers ?? {}),
        };
        const plan = await this.resolveRoutePlan(config.url, config);
        const routes = [plan.primary, plan.fallback].filter(Boolean) as NetworkResolvedRoute[];

        let lastError: unknown;
        for (let i = 0; i < routes.length; i++) {
            const route = routes[i];
            try {
                const { response, durationMs } = await this.executeRoute(config, route, headers, requestId);
                const data = await this.parseResponse<T>(config.parseAs, response, config, route, requestId, durationMs);
                return {
                    data,
                    response,
                    route,
                    requestId,
                    durationMs,
                };
            } catch (error) {
                lastError = error;
                if (
                    error instanceof NetworkRequestError &&
                    (error.code === 'http' || error.code === 'parse')
                ) {
                    throw error;
                }
                if (i >= routes.length - 1) {
                    throw error;
                }
            }
        }

        if (lastError instanceof Error) {
            throw lastError;
        }
        throw new Error('Unknown network request failure');
    }
}

