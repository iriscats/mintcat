/**
 * Shared request/response contracts for the unified frontend network layer.
 *
 * This file only defines types and constants. Runtime behavior such as route
 * selection, logging, retries, and auth resolution lives in the corresponding
 * service implementations.
 */

/**
 * Controls how a request URL should be routed before it is sent.
 *
 * Important:
 * - `mintcatProxy*` policies only make sense for non-MintCat targets.
 * - MintCat's own API requests should generally stay on `direct`.
 * - If a caller wants to explicitly avoid proxy rewriting, use `direct`.
 */
export type NetworkProxyPolicy =
    /** Send the request to the original URL exactly as provided. */
    | 'direct'
    /** Try direct first, then retry through MintCat `/proxy` when appropriate. */
    | 'mintcatProxyFallback'
    /** Always rewrite the request to MintCat `/proxy` when the target supports it. */
    | 'forceMintcatProxy';

/**
 * Selects which token source should be resolved and injected by `AuthResolver`.
 *
 * This keeps platform-specific token lookup out of individual API modules.
 */
export type NetworkAuthPolicy =
    /** Do not attach any auth header automatically. */
    | 'none'
    /** Attach the active MintCat bearer token, if present. */
    | 'mintcatToken'
    /** Attach the active mod.io bearer token, if present. */
    | 'modioToken'
    /** Attach the active ModCat bearer token, if present. */
    | 'modcatToken';

/**
 * Describes how the caller wants the response body to be returned.
 *
 * - `response`: keep the raw `Response`
 * - `json`: parse JSON if possible
 * - `text`: parse as plain text
 * - `bytes`: parse as `Uint8Array`
 */
export type NetworkParseAs = 'response' | 'json' | 'text' | 'bytes';

/**
 * User-facing MintCat proxy mode stored in settings.
 *
 * This only applies to external requests that may be forwarded by MintCat
 * `/proxy`. It does not change how MintCat's own API origin is selected.
 */
export type MintcatProxyMode = 'auto' | 'enabled' | 'disabled';

/** Settings key used to persist the MintCat proxy mode. */
export const NETWORK_MINTCAT_PROXY_MODE_KEY = 'network.mintcat_proxy_mode';
/** Default timeout for regular frontend HTTP requests. */
export const DEFAULT_NETWORK_TIMEOUT_MS = 5000;
/** Delay between retry attempts for lightweight requests. */
export const DEFAULT_NETWORK_RETRY_DELAY_MS = 10;
/** Default max retry count used by the shared client. */
export const DEFAULT_NETWORK_MAX_TRY = 2;

/** Retry behavior for a single route attempt. */
export interface NetworkRetryConfig {
    /** Maximum number of attempts on the same resolved route. */
    maxTry?: number;
    /** Delay between attempts, in milliseconds. */
    delayMs?: number;
}

/**
 * Full request description consumed by `NetworkClient`.
 *
 * Callers provide business context (`service`) plus transport preferences
 * (timeout, retries, auth, proxy policy, response parsing).
 */
export interface NetworkRequestConfig {
    /** Stable service label used for logs and diagnostics. */
    service: string;
    /** Absolute request URL before any route rewriting is applied. */
    url: string;
    /** HTTP method, defaults to GET when omitted. */
    method?: string;
    /** Extra headers merged after any auth headers resolved by policy. */
    headers?: Record<string, string>;
    /** Request body passed through to `fetch`. */
    body?: BodyInit | null;
    /** Per-request timeout override, in milliseconds. */
    timeoutMs?: number;
    /** Retry behavior for the currently selected route. */
    retry?: NetworkRetryConfig;
    /** Route strategy used to decide direct vs MintCat `/proxy`. */
    proxyPolicy?: NetworkProxyPolicy;
    /** Auth strategy used to resolve bearer headers automatically. */
    authPolicy?: NetworkAuthPolicy;
    /** Whether non-2xx responses should be raised as transport-level errors. */
    throwOnHttpError?: boolean;
    /** How the response body should be parsed before returning to the caller. */
    parseAs?: NetworkParseAs;
}

/**
 * A concrete route chosen by `RoutePolicy`.
 *
 * This captures both the caller's original target and the actual URL used for
 * the request after direct/proxy resolution.
 */
export interface NetworkResolvedRoute {
    /** Original URL requested by the caller before any rewriting. */
    originalUrl: string;
    /** Final URL sent to `fetch` or the download manager. */
    resolvedUrl: string;
    /** Whether this route is direct or routed through MintCat `/proxy`. */
    kind: 'direct' | 'mintcat_proxy';
    /** Effective MintCat proxy mode when proxy routing is involved. */
    proxyMode: MintcatProxyMode | null;
}

/**
 * Route selection result returned by `RoutePolicy`.
 *
 * `primary` is always attempted first. `fallback` is optional and is only used
 * when the policy allows a second path, such as direct -> MintCat proxy.
 */
export interface NetworkRoutePlan {
    /** Preferred route for the first attempt. */
    primary: NetworkResolvedRoute;
    /** Optional fallback route used after a transport failure. */
    fallback?: NetworkResolvedRoute;
}

/**
 * Unified response envelope returned by `NetworkClient`.
 *
 * It keeps the parsed payload together with the raw `Response` and runtime
 * metadata useful for tracing and diagnostics.
 */
export interface NetworkResponse<T = Response> {
    /** Parsed payload requested by `parseAs`. */
    data: T;
    /** Original raw `Response` object from `fetch`. */
    response: Response;
    /** Concrete route that ultimately succeeded. */
    route: NetworkResolvedRoute;
    /** Correlation id shared across logs for this request. */
    requestId: string;
    /** End-to-end duration for the successful route, in milliseconds. */
    durationMs: number;
}

/** High-level error categories emitted by the shared network layer. */
export type NetworkErrorCode = 'network' | 'timeout' | 'http' | 'parse';

/** Extra metadata stored on `NetworkRequestError`. */
export interface NetworkRequestErrorOptions {
    /** Classified failure type. */
    code: NetworkErrorCode;
    /** Correlation id of the failed request. */
    requestId: string;
    /** Service label originally provided by the caller. */
    service: string;
    /** Route that was being executed when the failure happened. */
    route: NetworkResolvedRoute;
    /** Optional duration captured before the error was raised. */
    durationMs?: number;
    /** HTTP status when the failure was caused by a non-2xx response. */
    status?: number;
    /** Raw response for HTTP and parse failures when available. */
    response?: Response;
    /** Underlying thrown value from `fetch`, parsing, or caller code. */
    cause?: unknown;
}

/**
 * Structured error used by the shared network client.
 *
 * This is intended for transport-level handling and logging. Higher-level API
 * modules can still translate it into business-friendly messages if needed.
 */
export class NetworkRequestError extends Error {
    /** Classified failure type for branching logic. */
    public readonly code: NetworkErrorCode;
    /** Correlation id matching request logs. */
    public readonly requestId: string;
    /** Service label attached by the caller. */
    public readonly service: string;
    /** Route metadata describing where the failed request was sent. */
    public readonly route: NetworkResolvedRoute;
    /** Measured duration before the failure occurred, if captured. */
    public readonly durationMs?: number;
    /** HTTP status code for HTTP failures. */
    public readonly status?: number;
    /** Raw response reference for HTTP or parse failures. */
    public readonly response?: Response;
    /** Original low-level thrown value. */
    public readonly cause?: unknown;

    public constructor(message: string, options: NetworkRequestErrorOptions) {
        super(message);
        this.name = 'NetworkRequestError';
        this.code = options.code;
        this.requestId = options.requestId;
        this.service = options.service;
        this.route = options.route;
        this.durationMs = options.durationMs;
        this.status = options.status;
        this.response = options.response;
        this.cause = options.cause;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

