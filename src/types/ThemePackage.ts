export type ThemePackageSource = 'builtin' | 'installed';
export type ThemeMode = 'light' | 'dark';

export type BackgroundSourceType =
    | 'none'
    | 'image'
    | 'video'
    | 'remote-image'
    | 'remote-video';

export interface BackgroundSettings {
    sourceType: BackgroundSourceType;
    sourceValue: string;
    opacity: number;
}

export interface ThemePackageBackgroundCapabilities {
    image: boolean;
    video: boolean;
}

export interface ThemePackageTokenConfig {
    colorPrimary?: string;
    mode?: ThemeMode;
}

export interface ThemePackageManifest {
    id: string;
    name: string;
    nameKey?: string;
    version: string;
    author?: string;
    description?: string;
    entryCss: string;
    source: ThemePackageSource;
    installDir?: string;
    removable?: boolean;
    previewColor?: string;
    tokens?: ThemePackageTokenConfig;
    capabilities?: {
        background?: Partial<ThemePackageBackgroundCapabilities>;
    };
    defaults?: {
        background?: Partial<BackgroundSettings>;
    };
}

export interface InstalledThemePackageResult {
    id: string;
}

export interface ThemePackageSummary extends ThemePackageManifest {
    removable: boolean;
}

export const DEFAULT_THEME_PACKAGE_ID = 'builtin-purple';

export const DEFAULT_BACKGROUND_OPACITY = 0.24;
export const MIN_BACKGROUND_OPACITY = 0.05;
export const MAX_BACKGROUND_OPACITY = 0.9;

export const DEFAULT_BACKGROUND_SETTINGS: BackgroundSettings = {
    sourceType: 'none',
    sourceValue: '',
    opacity: DEFAULT_BACKGROUND_OPACITY,
};

export const DEFAULT_THEME_BACKGROUND_CAPABILITIES: ThemePackageBackgroundCapabilities = {
    image: true,
    video: true,
};

export function clampBackgroundOpacity(value: number): number {
    if (!Number.isFinite(value)) {
        return DEFAULT_BACKGROUND_OPACITY;
    }

    const normalized = Math.min(MAX_BACKGROUND_OPACITY, Math.max(MIN_BACKGROUND_OPACITY, value));
    return Math.round(normalized * 100) / 100;
}

export function normalizeBackgroundSettings(
    settings?: Partial<BackgroundSettings>,
): BackgroundSettings {
    return {
        sourceType: settings?.sourceType ?? DEFAULT_BACKGROUND_SETTINGS.sourceType,
        sourceValue: settings?.sourceValue?.trim() ?? '',
        opacity: clampBackgroundOpacity(settings?.opacity ?? DEFAULT_BACKGROUND_SETTINGS.opacity),
    };
}

export function normalizeThemePackageCapabilities(
    capabilities?: ThemePackageManifest['capabilities'],
): ThemePackageBackgroundCapabilities {
    return {
        image: capabilities?.background?.image ?? DEFAULT_THEME_BACKGROUND_CAPABILITIES.image,
        video: capabilities?.background?.video ?? DEFAULT_THEME_BACKGROUND_CAPABILITIES.video,
    };
}

export function isVideoBackgroundSourceType(sourceType: BackgroundSourceType): boolean {
    return sourceType === 'video' || sourceType === 'remote-video';
}

export function isImageBackgroundSourceType(sourceType: BackgroundSourceType): boolean {
    return sourceType === 'image' || sourceType === 'remote-image';
}

export function isRemoteBackgroundSourceType(sourceType: BackgroundSourceType): boolean {
    return sourceType === 'remote-image' || sourceType === 'remote-video';
}

export function normalizeThemePackageManifest(
    manifest: ThemePackageManifest,
): ThemePackageSummary {
    return {
        ...manifest,
        removable: manifest.source === 'installed',
        capabilities: {
            background: normalizeThemePackageCapabilities(manifest.capabilities),
        },
        defaults: manifest.defaults?.background
            ? { background: normalizeBackgroundSettings(manifest.defaults.background) }
            : undefined,
    };
}
