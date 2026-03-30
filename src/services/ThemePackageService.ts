import {appConfigDir} from "@tauri-apps/api/path";
import {path} from "@tauri-apps/api";
import {invoke} from "@tauri-apps/api/core";
import {convertFileSrc} from "@tauri-apps/api/core";
import {exists, mkdir, readDir, readTextFile, remove} from "@tauri-apps/plugin-fs";

import {StorageAPI} from "@/storage";
import {
    DEFAULT_BACKGROUND_SETTINGS,
    DEFAULT_THEME_PACKAGE_ID,
    isImageBackgroundSourceType,
    isRemoteBackgroundSourceType,
    isVideoBackgroundSourceType,
    normalizeBackgroundSettings,
    normalizeThemePackageCapabilities,
    normalizeThemePackageManifest,
    type BackgroundSettings,
    type BackgroundSourceType,
    type InstalledThemePackageResult,
    type ThemePackageManifest,
    type ThemePackageSummary,
} from "@/types/ThemePackage.ts";

const BUILT_IN_THEME_PACKAGES: ThemePackageManifest[] = [
    {
        id: "builtin-purple",
        name: "Purple",
        nameKey: "Light",
        version: "1.0.0",
        source: "builtin",
        removable: false,
        entryCss: "/themes/purple-theme.css",
        previewColor: "#804bcc",
        tokens: {
            colorPrimary: "#804bcc",
            mode: "light",
        },
    },
    {
        id: "builtin-blue",
        name: "Blue",
        nameKey: "Blue",
        version: "1.0.0",
        source: "builtin",
        removable: false,
        entryCss: "/themes/blue-theme.css",
        previewColor: "#1677FF",
        tokens: {
            colorPrimary: "#1677FF",
            mode: "light",
        },
    },
    {
        id: "builtin-dark",
        name: "Dark",
        nameKey: "Dark",
        version: "1.0.0",
        source: "builtin",
        removable: false,
        entryCss: "/themes/dark-theme.css",
        previewColor: "#111111",
        tokens: {
            colorPrimary: "#E98800",
            mode: "dark",
        },
        capabilities: {
            background: {
                image: true,
                video: false,
            },
        },
    },
    {
        id: "builtin-pink",
        name: "Pink",
        nameKey: "Pink",
        version: "1.0.0",
        source: "builtin",
        removable: false,
        entryCss: "/themes/pink-theme.css",
        previewColor: "#ff69b4",
        tokens: {
            colorPrimary: "#ff69b4",
            mode: "light",
        },
    },
];

const LEGACY_THEME_ID_MAP: Record<string, string> = {
    Light: "builtin-purple",
    Blue: "builtin-blue",
    Dark: "builtin-dark",
    Pink: "builtin-pink",
};

interface RawThemePackageManifest {
    id?: string;
    name?: string;
    nameKey?: string;
    version?: string;
    author?: string;
    description?: string;
    entryCss?: string;
    entry_css?: string;
    previewColor?: string;
    preview_color?: string;
    tokens?: ThemePackageManifest["tokens"];
    capabilities?: ThemePackageManifest["capabilities"];
    defaults?: ThemePackageManifest["defaults"];
}

export class ThemePackageService {
    public static async getThemesRootDir(): Promise<string> {
        return await path.join(await appConfigDir(), "themes");
    }

    public static async ensureThemesRootDir(): Promise<string> {
        const rootDir = await this.getThemesRootDir();
        if (!(await exists(rootDir))) {
            await mkdir(rootDir, {recursive: true});
        }
        return rootDir;
    }

    public static getBuiltInThemePackages(): ThemePackageSummary[] {
        return BUILT_IN_THEME_PACKAGES.map((item) => normalizeThemePackageManifest(item));
    }

    private static async readManifestFromDir(dirPath: string): Promise<ThemePackageSummary | null> {
        const candidates = ["theme.json", "manifest.json"];

        for (const fileName of candidates) {
            const manifestPath = await path.join(dirPath, fileName);
            if (!(await exists(manifestPath))) {
                continue;
            }

            try {
                const rawContent = await readTextFile(manifestPath);
                const rawManifest = JSON.parse(rawContent) as RawThemePackageManifest;
                if (!rawManifest.id || !rawManifest.name) {
                    return null;
                }

                const manifest: ThemePackageManifest = {
                    id: rawManifest.id,
                    name: rawManifest.name,
                    nameKey: rawManifest.nameKey,
                    version: rawManifest.version || "1.0.0",
                    author: rawManifest.author,
                    description: rawManifest.description,
                    entryCss: rawManifest.entryCss || rawManifest.entry_css || "theme.css",
                    previewColor: rawManifest.previewColor || rawManifest.preview_color,
                    tokens: rawManifest.tokens,
                    capabilities: rawManifest.capabilities,
                    defaults: rawManifest.defaults,
                    source: "installed",
                    installDir: dirPath,
                    removable: true,
                };

                return normalizeThemePackageManifest(manifest);
            } catch (error) {
                console.warn("[ThemePackageService] Failed to read theme manifest:", dirPath, error);
                return null;
            }
        }

        return null;
    }

    public static async getInstalledThemePackages(): Promise<ThemePackageSummary[]> {
        const rootDir = await this.ensureThemesRootDir();
        const entries = await readDir(rootDir);
        const result: ThemePackageSummary[] = [];

        for (const entry of entries) {
            if (!entry.isDirectory || !entry.name) {
                continue;
            }

            const dirPath = await path.join(rootDir, entry.name);
            const manifest = await this.readManifestFromDir(dirPath);
            if (manifest) {
                result.push(manifest);
            }
        }

        return result.sort((a, b) => a.name.localeCompare(b.name));
    }

    public static async listThemePackages(): Promise<ThemePackageSummary[]> {
        const installed = await this.getInstalledThemePackages();
        const builtin = this.getBuiltInThemePackages();
        const builtinIds = new Set(builtin.map((item) => item.id));
        return [...builtin, ...installed.filter((item) => !builtinIds.has(item.id))];
    }

    public static async getThemePackageById(themePackageId: string): Promise<ThemePackageSummary | null> {
        const builtin = this.getBuiltInThemePackages().find((item) => item.id === themePackageId);
        if (builtin) {
            return builtin;
        }

        const installed = await this.getInstalledThemePackages();
        return installed.find((item) => item.id === themePackageId) ?? null;
    }

    public static async getStoredActiveThemePackageId(): Promise<string> {
        const settings = await StorageAPI.getSettings();
        const themePackageId = await settings.getActiveThemePackageId();
        if (themePackageId) {
            return themePackageId;
        }

        const legacyTheme = await settings.getGuiTheme();
        return LEGACY_THEME_ID_MAP[legacyTheme] ?? DEFAULT_THEME_PACKAGE_ID;
    }

    public static async getActiveThemePackage(): Promise<ThemePackageSummary> {
        const settings = await StorageAPI.getSettings();
        let themePackageId = await this.getStoredActiveThemePackageId();
        let themePackage = await this.getThemePackageById(themePackageId);

        if (!themePackage) {
            themePackageId = DEFAULT_THEME_PACKAGE_ID;
            themePackage = await this.getThemePackageById(themePackageId);
        }

        if (!themePackage) {
            throw new Error("Default theme package is missing");
        }

        await settings.setActiveThemePackageId(themePackage.id);
        return themePackage;
    }

    public static async setActiveThemePackage(themePackageId: string): Promise<ThemePackageSummary> {
        const settings = await StorageAPI.getSettings();
        const themePackage = await this.getThemePackageById(themePackageId);
        if (!themePackage) {
            throw new Error(`Theme package not found: ${themePackageId}`);
        }

        await settings.setActiveThemePackageId(themePackage.id);
        return themePackage;
    }

    public static async installThemePackageFromZip(zipPath: string): Promise<string> {
        const themesDir = await this.ensureThemesRootDir();
        const result = await invoke<InstalledThemePackageResult>("install_theme_package", {
            zipPath,
            themesDir,
        });
        return result.id;
    }

    public static async removeThemePackage(themePackageId: string): Promise<void> {
        const themePackage = await this.getThemePackageById(themePackageId);
        if (!themePackage || themePackage.source !== "installed" || !themePackage.installDir) {
            throw new Error("Only installed theme packages can be removed");
        }

        await remove(themePackage.installDir, {recursive: true});
    }

    public static async getBackgroundSettings(): Promise<BackgroundSettings> {
        const settings = await StorageAPI.getSettings();
        const legacyVideoPath = await settings.getValue("ui.backgroundVideoPath");
        const legacyVideoEnabled = (await settings.getValue("ui.backgroundVideoEnabled")) === "true";
        const legacyVideoOpacity = await settings.getValue("ui.backgroundVideoOpacity");

        const sourceType = await settings.getBackgroundSourceType();
        const sourceValue = await settings.getBackgroundSourceValue();
        const opacity = await settings.getBackgroundOpacity();

        if (sourceType === "none" && sourceValue === "" && legacyVideoEnabled && legacyVideoPath) {
            return normalizeBackgroundSettings({
                sourceType: "video",
                sourceValue: legacyVideoPath,
                opacity: legacyVideoOpacity ? Number(legacyVideoOpacity) : opacity,
            });
        }

        return normalizeBackgroundSettings({
            sourceType,
            sourceValue,
            opacity,
        });
    }

    public static async setBackgroundSettings(backgroundSettings: BackgroundSettings): Promise<BackgroundSettings> {
        const settings = await StorageAPI.getSettings();
        const normalized = normalizeBackgroundSettings(backgroundSettings);

        await settings.setBackgroundSourceType(normalized.sourceType);
        await settings.setBackgroundSourceValue(normalized.sourceValue);
        await settings.setBackgroundOpacity(normalized.opacity);

        return normalized;
    }

    public static canUseBackgroundSource(
        themePackage: ThemePackageSummary,
        sourceType: BackgroundSourceType,
    ): boolean {
        if (sourceType === "none") {
            return true;
        }

        const capabilities = normalizeThemePackageCapabilities(themePackage.capabilities);
        if (isVideoBackgroundSourceType(sourceType)) {
            return capabilities.video;
        }

        if (isImageBackgroundSourceType(sourceType)) {
            return capabilities.image;
        }

        return true;
    }

    public static async sanitizeBackgroundSettingsForTheme(
        themePackage: ThemePackageSummary,
        backgroundSettings?: BackgroundSettings,
    ): Promise<BackgroundSettings> {
        const current = backgroundSettings ?? await this.getBackgroundSettings();
        if (this.canUseBackgroundSource(themePackage, current.sourceType)) {
            return current;
        }

        const fallback = DEFAULT_BACKGROUND_SETTINGS;
        await this.setBackgroundSettings(fallback);
        return fallback;
    }

    public static async getEffectiveBackgroundSettings(
        themePackage?: ThemePackageSummary,
    ): Promise<BackgroundSettings> {
        const activeThemePackage = themePackage ?? await this.getActiveThemePackage();
        const userBackground = await this.getBackgroundSettings();

        if (this.canUseBackgroundSource(activeThemePackage, userBackground.sourceType) && userBackground.sourceValue) {
            return userBackground;
        }

        if (userBackground.sourceType === "none") {
            const fallback = activeThemePackage.defaults?.background;
            if (fallback && this.canUseBackgroundSource(activeThemePackage, fallback.sourceType)) {
                return normalizeBackgroundSettings(fallback);
            }
            return DEFAULT_BACKGROUND_SETTINGS;
        }

        const themeDefault = activeThemePackage.defaults?.background;
        if (themeDefault && this.canUseBackgroundSource(activeThemePackage, themeDefault.sourceType)) {
            return normalizeBackgroundSettings(themeDefault);
        }

        return DEFAULT_BACKGROUND_SETTINGS;
    }

    public static async resolveThemeCssHref(themePackage: ThemePackageSummary): Promise<string | null> {
        const cacheBust = `v=${Date.now()}`;
        if (themePackage.source === "builtin") {
            return `${themePackage.entryCss}?${cacheBust}`;
        }

        if (!themePackage.installDir) {
            return null;
        }

        const cssPath = await path.join(themePackage.installDir, themePackage.entryCss);
        if (!(await exists(cssPath))) {
            return null;
        }

        return `${convertFileSrc(cssPath)}?${cacheBust}`;
    }

    public static async resolveThemeBackgroundSource(
        themePackage: ThemePackageSummary,
        backgroundSettings: BackgroundSettings,
    ): Promise<string> {
        if (!backgroundSettings.sourceValue) {
            return "";
        }

        if (isRemoteBackgroundSourceType(backgroundSettings.sourceType)) {
            return backgroundSettings.sourceValue;
        }

        if (backgroundSettings.sourceType === "image" || backgroundSettings.sourceType === "video") {
            const value = backgroundSettings.sourceValue;

            if (themePackage.source === "installed" && themePackage.installDir && !value.startsWith("/") && !value.match(/^[A-Za-z]:\\/)) {
                const packageAssetPath = await path.join(themePackage.installDir, value);
                return convertFileSrc(packageAssetPath);
            }

            return convertFileSrc(value);
        }

        return "";
    }
}
