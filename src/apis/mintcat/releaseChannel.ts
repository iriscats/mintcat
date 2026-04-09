/** MintCat Release API 内置资源发布渠道（与 /releases 查询参数一致） */

export const RELEASE_CHANNELS = ['stable', 'beta'] as const;

export type ReleaseChannel = (typeof RELEASE_CHANNELS)[number];

export const DEFAULT_RELEASE_CHANNEL: ReleaseChannel = 'stable';

export function isReleaseChannel(value: string): value is ReleaseChannel {
    return (RELEASE_CHANNELS as readonly string[]).includes(value);
}

export function normalizeReleaseChannel(value: string): ReleaseChannel {
    if (isReleaseChannel(value)) return value;
    return DEFAULT_RELEASE_CHANNEL;
}
