/** MintCat 静态更新清单内置资源发布渠道 */

import packageJson from '../../../package.json';

export const RELEASE_CHANNELS = ['stable', 'beta', 'alpha'] as const;

export type ReleaseChannel = (typeof RELEASE_CHANNELS)[number];

export const DEFAULT_RELEASE_CHANNEL: ReleaseChannel = isReleaseChannel(packageJson.channel)
    ? packageJson.channel
    : 'stable';

export function isReleaseChannel(value: string): value is ReleaseChannel {
    return (RELEASE_CHANNELS as readonly string[]).includes(value);
}

export function normalizeReleaseChannel(value: string): ReleaseChannel {
    if (isReleaseChannel(value)) return value;
    return DEFAULT_RELEASE_CHANNEL;
}
