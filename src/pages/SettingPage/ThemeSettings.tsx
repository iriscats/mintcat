import { t } from "i18next";
import React from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Button, Card, Flex, Form, Input, message, Modal, Select, Slider, Typography } from "antd";
import {
    DeleteOutlined,
    ExclamationCircleFilled,
    UploadOutlined,
} from "@ant-design/icons";

import { emitEvent, useEventListener } from "@/events";
import { SettingLayout } from "@/pages/SettingPage/Layout.ts";
import { ThemePackageService } from "@/services/ThemePackageService.ts";
import {
    clampBackgroundOpacity,
    DEFAULT_BACKGROUND_OPACITY,
    DEFAULT_THEME_PACKAGE_ID,
    MAX_BACKGROUND_OPACITY,
    MIN_BACKGROUND_OPACITY,
    normalizeThemePackageCapabilities,
    type BackgroundSettings,
    type BackgroundSourceType,
    type ThemePackageSummary,
} from "@/types/ThemePackage.ts";

const { Text } = Typography;

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "avif"];
const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "m4v"];

export function ThemeSettings() {
    const [themePackages, setThemePackages] = React.useState<ThemePackageSummary[]>([]);
    const [activeThemePackageId, setActiveThemePackageId] = React.useState<string>(DEFAULT_THEME_PACKAGE_ID);
    const [backgroundSourceType, setBackgroundSourceType] = React.useState<BackgroundSourceType>("none");
    const [backgroundSourceValue, setBackgroundSourceValue] = React.useState<string>("");
    const [backgroundOpacity, setBackgroundOpacity] = React.useState<number>(DEFAULT_BACKGROUND_OPACITY);

    const activeThemePackage = React.useMemo(() => {
        return themePackages.find((item) => item.id === activeThemePackageId) ?? null;
    }, [activeThemePackageId, themePackages]);

    const backgroundCapabilities = React.useMemo(() => {
        return normalizeThemePackageCapabilities(activeThemePackage?.capabilities);
    }, [activeThemePackage]);

    const themeOptions = React.useMemo(() => {
        return themePackages.map((item) => ({
            value: item.id,
            label: item.nameKey ? t(item.nameKey) : item.name,
        }));
    }, [themePackages]);

    const backgroundSourceOptions = React.useMemo(() => ([
        { value: "none", label: t("No Background") },
        { value: "image", label: t("Local Background Image"), disabled: !backgroundCapabilities.image },
        { value: "video", label: t("Local Background Video"), disabled: !backgroundCapabilities.video },
        { value: "remote-image", label: t("Remote Background Image"), disabled: !backgroundCapabilities.image },
        { value: "remote-video", label: t("Remote Background Video"), disabled: !backgroundCapabilities.video },
    ]), [backgroundCapabilities.image, backgroundCapabilities.video]);

    const refreshThemePackages = React.useCallback(async () => {
        const packages = await ThemePackageService.listThemePackages();
        const activeTheme = await ThemePackageService.getActiveThemePackage();
        setThemePackages(packages);
        setActiveThemePackageId(activeTheme.id);
    }, []);

    const fetchSettings = React.useCallback(async () => {
        const backgroundSettings = await ThemePackageService.getBackgroundSettings();
        await refreshThemePackages();
        setBackgroundSourceType(backgroundSettings.sourceType);
        setBackgroundSourceValue(backgroundSettings.sourceValue);
        setBackgroundOpacity(backgroundSettings.opacity);
    }, [refreshThemePackages]);

    const persistBackgroundSettings = React.useCallback(async (nextSettings: BackgroundSettings) => {
        const normalized = await ThemePackageService.setBackgroundSettings({
            sourceType: nextSettings.sourceType,
            sourceValue: nextSettings.sourceValue,
            opacity: clampBackgroundOpacity(nextSettings.opacity),
        });

        const themePackage = activeThemePackage ?? await ThemePackageService.getActiveThemePackage();
        const sanitized = await ThemePackageService.sanitizeBackgroundSettingsForTheme(themePackage, normalized);
        setBackgroundSourceType(sanitized.sourceType);
        setBackgroundSourceValue(sanitized.sourceValue);
        setBackgroundOpacity(sanitized.opacity);
        await emitEvent("background-source-change", sanitized);
    }, [activeThemePackage]);

    const pickBackgroundFile = React.useCallback(async (sourceType: BackgroundSourceType): Promise<string | null> => {
        const filters = sourceType === "video" || sourceType === "remote-video"
            ? [{ name: "Video", extensions: VIDEO_EXTENSIONS }]
            : [{ name: "Image", extensions: IMAGE_EXTENSIONS }];

        const result = await open({
            filters,
            multiple: false,
        });

        if (!result || Array.isArray(result)) {
            return null;
        }

        return result;
    }, []);

    const onThemePackageChange = async (value: string) => {
        try {
            const themePackage = await ThemePackageService.setActiveThemePackage(value);
            const sanitizedBackground = await ThemePackageService.sanitizeBackgroundSettingsForTheme(themePackage);
            setActiveThemePackageId(themePackage.id);
            setBackgroundSourceType(sanitizedBackground.sourceType);
            setBackgroundSourceValue(sanitizedBackground.sourceValue);
            setBackgroundOpacity(sanitizedBackground.opacity);
            await emitEvent("theme-package-change", themePackage.id);
            await emitEvent("background-source-change", sanitizedBackground);
        } catch (error) {
            console.error("Failed to change theme package:", error);
            message.error(t("Failed to activate theme package"));
        }
    };

    const onInstallThemePackageClick = async () => {
        const zipPath = await open({
            filters: [{
                name: "Theme Package",
                extensions: ["zip"],
            }],
            multiple: false,
        });

        if (!zipPath || Array.isArray(zipPath)) {
            return;
        }

        try {
            const installedThemeId = await ThemePackageService.installThemePackageFromZip(zipPath);
            await refreshThemePackages();
            await emitEvent("theme-package-installed", installedThemeId);
            message.success(t("Theme package installed"));
        } catch (error) {
            console.error("Failed to install theme package:", error);
            message.error(`${t("Failed to install theme package")}: ${error}`);
        }
    };

    const onDeleteThemePackageClick = async () => {
        if (!activeThemePackage || !activeThemePackage.removable) {
            return;
        }

        Modal.confirm({
            title: t("Delete Theme Package"),
            icon: <ExclamationCircleFilled />,
            content: t("Delete Theme Package Confirm"),
            okText: t("Delete"),
            okType: "danger",
            cancelText: t("Cancel"),
            onOk: async () => {
                try {
                    const deletingActiveTheme = activeThemePackage.id === activeThemePackageId;
                    await ThemePackageService.removeThemePackage(activeThemePackage.id);
                    if (deletingActiveTheme) {
                        const fallbackTheme = await ThemePackageService.setActiveThemePackage(DEFAULT_THEME_PACKAGE_ID);
                        await emitEvent("theme-package-change", fallbackTheme.id);
                    }
                    await refreshThemePackages();
                    message.success(t("Theme package deleted"));
                } catch (error) {
                    console.error("Failed to delete theme package:", error);
                    message.error(t("Failed to delete theme package"));
                }
            },
        });
    };

    const onBackgroundSourceTypeChange = async (value: BackgroundSourceType) => {
        await persistBackgroundSettings({
            sourceType: value,
            sourceValue: "",
            opacity: backgroundOpacity,
        });
    };

    const onSelectBackgroundSourceClick = async () => {
        const selectedPath = await pickBackgroundFile(backgroundSourceType);
        if (!selectedPath) {
            return;
        }

        await persistBackgroundSettings({
            sourceType: backgroundSourceType,
            sourceValue: selectedPath,
            opacity: backgroundOpacity,
        });
    };

    const onClearBackgroundSourceClick = async () => {
        await persistBackgroundSettings({
            sourceType: "none",
            sourceValue: "",
            opacity: backgroundOpacity,
        });
    };

    const onBackgroundRemoteUrlCommit = async () => {
        const trimmed = backgroundSourceValue.trim();
        if (!trimmed) {
            await persistBackgroundSettings({
                sourceType: "none",
                sourceValue: "",
                opacity: backgroundOpacity,
            });
            return;
        }

        if (!/^https?:\/\//i.test(trimmed)) {
            message.warning(t("Please enter a valid remote background URL"));
            return;
        }

        await persistBackgroundSettings({
            sourceType: backgroundSourceType,
            sourceValue: trimmed,
            opacity: backgroundOpacity,
        });
    };

    const onBackgroundOpacityChange = (value: number) => {
        const nextOpacity = clampBackgroundOpacity(value);
        setBackgroundOpacity(nextOpacity);
        void persistBackgroundSettings({
            sourceType: backgroundSourceType,
            sourceValue: backgroundSourceValue,
            opacity: nextOpacity,
        });
    };

    React.useEffect(() => {
        fetchSettings().then();
    }, [fetchSettings]);

    useEventListener("config-imported", () => {
        fetchSettings().then();
    });

    useEventListener("theme-package-change", (themePackageId) => {
        setActiveThemePackageId(themePackageId);
        refreshThemePackages().catch(console.error);
    });

    useEventListener("background-source-change", (settings) => {
        setBackgroundSourceType(settings.sourceType);
        setBackgroundSourceValue(settings.sourceValue);
        setBackgroundOpacity(settings.opacity);
    });

    const activeThemeDisplayName = activeThemePackage
        ? (activeThemePackage.nameKey ? t(activeThemePackage.nameKey) : activeThemePackage.name)
        : "-";

    const canUseLocalBackground = backgroundSourceType === "image" || backgroundSourceType === "video";
    const canUseRemoteBackground = backgroundSourceType === "remote-image" || backgroundSourceType === "remote-video";

    return (
        <Card title={t("Theme and Background")} style={{ marginBottom: "10px" }}>
            <Form {...SettingLayout}>
                <Form.Item label={t("Theme Package")}>
                    <Flex gap="small" vertical>
                        <Flex gap="small">
                            <Select
                                value={activeThemePackageId}
                                options={themeOptions}
                                style={{ flex: 1 }}
                                onChange={onThemePackageChange}
                            />
                            <Button icon={<UploadOutlined />} onClick={onInstallThemePackageClick}>
                                {t("Install Theme Package")}
                            </Button>
                            <Button
                                danger
                                icon={<DeleteOutlined />}
                                disabled={!activeThemePackage?.removable}
                                onClick={onDeleteThemePackageClick}
                            >
                                {t("Delete")}
                            </Button>
                        </Flex>
                        <Text type="secondary">
                            {t("Active Theme Package")}: {activeThemeDisplayName}
                            {activeThemePackage?.author ? ` · ${activeThemePackage.author}` : ""}
                            {activeThemePackage?.version ? ` · v${activeThemePackage.version}` : ""}
                        </Text>
                        <Text type="secondary">
                            {t("Theme Background Capability Summary", {
                                image: backgroundCapabilities.image ? t("Supported") : t("Disabled"),
                                video: backgroundCapabilities.video ? t("Supported") : t("Disabled"),
                            })}
                        </Text>
                    </Flex>
                </Form.Item>
                <Form.Item label={t("Background Source")}>
                    <Select
                        value={backgroundSourceType}
                        options={backgroundSourceOptions}
                        onChange={onBackgroundSourceTypeChange}
                    />
                </Form.Item>
                <Form.Item label={t("Background Resource")}>
                    {canUseLocalBackground && (
                        <Flex gap="small">
                            <Input
                                value={backgroundSourceValue}
                                placeholder={t("Select a local background file")}
                                readOnly
                            />
                            <Button type="default" onClick={onSelectBackgroundSourceClick}>
                                {t("Browse")}
                            </Button>
                            <Button
                                type="default"
                                disabled={!backgroundSourceValue}
                                onClick={onClearBackgroundSourceClick}
                            >
                                {t("Clear")}
                            </Button>
                        </Flex>
                    )}
                    {canUseRemoteBackground && (
                        <Input
                            value={backgroundSourceValue}
                            placeholder={t("Enter remote background URL")}
                            onChange={(event) => setBackgroundSourceValue(event.target.value)}
                            onBlur={onBackgroundRemoteUrlCommit}
                            onPressEnter={onBackgroundRemoteUrlCommit}
                        />
                    )}
                    {backgroundSourceType === "none" && (
                        <Input value={t("No Background")} readOnly />
                    )}
                </Form.Item>
                <Form.Item label={t("Background Opacity")}>
                    <Flex gap="middle" align="center">
                        <Slider
                            min={MIN_BACKGROUND_OPACITY * 100}
                            max={MAX_BACKGROUND_OPACITY * 100}
                            step={5}
                            value={Math.round(backgroundOpacity * 100)}
                            disabled={backgroundSourceType === "none"}
                            style={{ flex: 1, margin: 0 }}
                            onChange={(value) => {
                                if (typeof value === "number") {
                                    onBackgroundOpacityChange(value / 100);
                                }
                            }}
                        />
                        <span style={{ minWidth: 44, textAlign: "right" }}>
                            {Math.round(backgroundOpacity * 100)}%
                        </span>
                    </Flex>
                </Form.Item>
            </Form>
        </Card>
    );
}
