import React from "react";
import {exists} from "@tauri-apps/plugin-fs";

import {ThemePackageService} from "@/services/ThemePackageService.ts";
import {
    clampBackgroundOpacity,
    isImageBackgroundSourceType,
    isVideoBackgroundSourceType,
    type BackgroundSettings,
    type ThemePackageSummary,
} from "@/types/ThemePackage.ts";

interface BackgroundLayerProps {
    themePackage: ThemePackageSummary | null;
    backgroundSettings: BackgroundSettings;
}

export function BackgroundLayer({themePackage, backgroundSettings}: BackgroundLayerProps) {
    const [resolvedSource, setResolvedSource] = React.useState("");
    const [videoReady, setVideoReady] = React.useState(false);
    const [loadFailed, setLoadFailed] = React.useState(false);

    React.useEffect(() => {
        let cancelled = false;

        const loadSource = async () => {
            setResolvedSource("");
            setVideoReady(false);
            setLoadFailed(false);

            if (!themePackage || backgroundSettings.sourceType === "none" || !backgroundSettings.sourceValue) {
                return;
            }

            try {
                const source = await ThemePackageService.resolveThemeBackgroundSource(themePackage, backgroundSettings);
                if (!source) {
                    if (!cancelled) {
                        setLoadFailed(true);
                    }
                    return;
                }

                if ((backgroundSettings.sourceType === "image" || backgroundSettings.sourceType === "video")
                    && !backgroundSettings.sourceValue.startsWith("/")
                    && !backgroundSettings.sourceValue.match(/^[A-Za-z]:\\/)) {
                    if (themePackage.source === "installed") {
                        if (!cancelled) {
                            setResolvedSource(source);
                        }
                        return;
                    }
                }

                if ((backgroundSettings.sourceType === "image" || backgroundSettings.sourceType === "video")
                    && !backgroundSettings.sourceValue.startsWith("/")
                    && !backgroundSettings.sourceValue.match(/^[A-Za-z]:\\/)
                    && themePackage.source !== "installed") {
                    if (!cancelled) {
                        setResolvedSource(source);
                    }
                    return;
                }

                if (backgroundSettings.sourceType === "image" || backgroundSettings.sourceType === "video") {
                    const isLocalFile = !backgroundSettings.sourceValue.startsWith("/")
                        ? !backgroundSettings.sourceValue.startsWith("http://") && !backgroundSettings.sourceValue.startsWith("https://")
                        : true;
                    if (isLocalFile) {
                        const fileExists = await exists(backgroundSettings.sourceValue);
                        if (!fileExists && themePackage.source !== "installed") {
                            if (!cancelled) {
                                setLoadFailed(true);
                            }
                            return;
                        }
                    }
                }

                if (!cancelled) {
                    setResolvedSource(source);
                }
            } catch (error) {
                if (!cancelled) {
                    console.warn("[BackgroundLayer] Failed to resolve background source:", error);
                    setLoadFailed(true);
                }
            }
        };

        void loadSource();

        return () => {
            cancelled = true;
        };
    }, [backgroundSettings, themePackage]);

    const opacity = clampBackgroundOpacity(backgroundSettings.opacity);

    return (
        <div className="app-background-layer" aria-hidden="true">
            <div className="app-background-fallback"/>
            {!loadFailed && resolvedSource !== "" && isImageBackgroundSourceType(backgroundSettings.sourceType) && (
                <div
                    className="app-background-image"
                    style={{
                        opacity,
                        backgroundImage: `url("${resolvedSource}")`,
                    }}
                />
            )}
            {!loadFailed && resolvedSource !== "" && isVideoBackgroundSourceType(backgroundSettings.sourceType) && (
                <video
                    key={resolvedSource}
                    className="app-background-video"
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="metadata"
                    src={resolvedSource}
                    style={{opacity: videoReady ? Math.min(0.88, opacity * 1.25) : 0}}
                    onCanPlay={() => setVideoReady(true)}
                    onError={() => {
                        console.warn("[BackgroundLayer] Background video failed to load:", resolvedSource);
                        setVideoReady(false);
                        setLoadFailed(true);
                    }}
                />
            )}
            <div className="app-background-scrim"/>
        </div>
    );
}
