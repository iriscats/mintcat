import {t} from "i18next";
import React from "react";
import {openPath} from "@tauri-apps/plugin-opener";
import {open} from "@tauri-apps/plugin-dialog";
import i18n from "@/locales/i18n.ts";
import {IntegrateApi} from "@/apis/IntegrateApi.ts";
import {CacheApi} from "@/apis/CacheApi.ts";
import {DEFAULT_RELEASE_CHANNEL, RELEASE_CHANNELS, type ReleaseChannel} from "@/apis/mintcat";
import {StorageAPI} from "@/storage";
import {Button, Card, Flex, Form, Input, message, Modal, Select, Switch} from "antd";
import {ExclamationCircleFilled} from "@ant-design/icons";
import {FolderAddOutlined} from "@ant-design/icons";
import {ClipboardApi} from "@/apis/ClipboardApi.ts";
import Search from "antd/es/input/Search";
import {ButtonLayout, SettingLayout} from "@/pages/SettingPage/Layout.ts";
import {emitEvent, emitVoidEvent, useEventListener} from "@/events";
import {
    normalizeUe4ssSetting,
    UE4SS_SETTING_DISABLED,
    UE4SS_SETTING_ENABLED,
    type Ue4ssSetting,
} from "@/utils/Ue4ssSetting.ts";



export function MintCatSettings() {

    const languageOptions = [
        {value: 'en', label: t("English")},
        {value: 'zh', label: t('Chinese')},
    ];

    const themeOptions = [
        {value: 'Light', label: t('Light')},
        {value: 'Blue', label: t('Blue')},
        {value: 'Dark', label: t('Dark')},
        {value: 'Pink', label: t('Pink')},
    ];

    const [language, setLanguage] = React.useState<string>("en");
    const [theme, setTheme] = React.useState<string>("Light");
    const [configDirectory, setConfigDirectory] = React.useState<string>("");
    const [cacheDirectory, setCacheDirectory] = React.useState<string>("");
    const [ue4ss, setUe4ss] = React.useState<Ue4ssSetting>(UE4SS_SETTING_ENABLED);
    const [releaseChannel, setReleaseChannel] = React.useState<ReleaseChannel>(DEFAULT_RELEASE_CHANNEL);
    const [clipboardMonitor, setClipboardMonitor] = React.useState<boolean>(true);

    const releaseChannelOptions = RELEASE_CHANNELS.map((value) => ({
        value,
        label: t(`Release channel option ${value}`),
    }));

    const onOpenConfigDirClick = async () => {
        const settings = await StorageAPI.getSettings();
        await openPath(await settings.getConfigPath());
    }

    const onOpenCacheDirClick = async () => {
        await openPath(cacheDirectory);
    }

    const onSelectCacheDirClick = async () => {
        const result = await open({
            directory: true
        });
        if (result) {
            // 检查是否与当前缓存目录相同
            const settings = await StorageAPI.getSettings();
            const currentCachePath = await settings.getCachePath();
            
            if (result === currentCachePath) {
                message.info(t("cache.sameAsCurrent"));
                return;
            }
            
            // 显示确认对话框
            Modal.confirm({
                title: t("Change Cache Directory"),
                icon: <ExclamationCircleFilled />,
                content: t("cache.changeDirectoryConfirm"),
                okText: t("Confirm"),
                cancelText: t("Cancel"),
                onOk: async () => {
                    try {
                        // 更新设置
                        setCacheDirectory(result);
                        await settings.setCachePath(result);
                        
                        // 清除内存缓存
                        CacheApi.clearCache();
                        
                        // 清除所有 Modio mod 的缓存路径
                        const modsDAO = await StorageAPI.getMods();
                        await modsDAO.clearAllModioCachePaths();
                        
                        message.success(t("cache.directoryChangedSuccess"));
                    } catch (error) {
                        console.error("error.changeCacheDirectory:", error);
                        message.error(t("error.changeCacheDirectory"));
                    }
                }
            });
        }
    }

    const onLanguageChange = async (value: string) => {
        setLanguage(value);
        await i18n.changeLanguage(value);
        const settings = await StorageAPI.getSettings();
        await settings.setLanguage(value);
        window.location.reload();
    }

    const onThemeChange = async (value: string) => {
        setTheme(value);
        const settings = await StorageAPI.getSettings();
        await settings.setGuiTheme(value);
        localStorage.setItem('theme', value);
        await emitEvent("theme-change", value);
    }

    const onReleaseChannelChange = async (value: ReleaseChannel) => {
        setReleaseChannel(value);
        const settings = await StorageAPI.getSettings();
        await settings.setReleaseChannel(value);
        message.success(t("Release channel saved"));
    };

    const onUe4ssChange = async (value: Ue4ssSetting) => {
        setUe4ss(value);
        const settings = await StorageAPI.getSettings();
        await settings.setValue('ue4ss', value);
    }

    const onClipboardMonitorChange = async (checked: boolean) => {
        setClipboardMonitor(checked);
        const settings = await StorageAPI.getSettings();
        await settings.setClipboardMonitorEnabled(checked);
        if (checked) {
            await ClipboardApi.restartClipboardWatcher();
        } else {
            ClipboardApi.stopClipboardWatcher();
        }
    }

    const onDevToolsClick = async () => {
        await IntegrateApi.openDevTools();
    }

    const onClearCacheClick = async () => {
        Modal.confirm({
            title: t("Clear Current Cache"),
            icon: <ExclamationCircleFilled />,
            content: t("Clear Cache Warning"),
            okText: t("Clean"),
            okType: 'danger',
            cancelText: t("Cancel"),
            onOk: async () => {
                if (await CacheApi.cleanCurrentCache()) {
                    message.success(t("Clean Cache Success"));
                } else {
                    message.error(t("Clean Cache Failed"));
                }
            }
        });
    }

    const onImportConfigClick = async () => {
        await emitVoidEvent("config-manage-dialog-open");
    }

    // ✅ 使用 useEventListener 自动管理清理
    useEventListener("theme-change", (theme) => {
        setTheme(theme);
    });

    const fetchSettings = React.useCallback(async () => {
        const settings = await StorageAPI.getSettings();
        setLanguage(await settings.getLanguage());
        setTheme(await settings.getGuiTheme());
        setConfigDirectory(await settings.getConfigPath());
        setCacheDirectory(await settings.getCachePath());
        const ue4ssValue = await settings.getValue('ue4ss');
        setUe4ss(normalizeUe4ssSetting(ue4ssValue));
        setReleaseChannel(await settings.getReleaseChannel());
        setClipboardMonitor(await settings.getClipboardMonitorEnabled());
    }, []);

    React.useEffect(() => {
        fetchSettings().then();
    }, [fetchSettings]);

    useEventListener("config-imported", () => {
        fetchSettings().then();
    });

    return (
        <>
            <Card title={t("MintCat Settings")}
                  style={{marginBottom: "10px"}}
            >
                <Form {...SettingLayout}
                >
                    <Form.Item label={t("Language")} name="language">
                        <Flex>
                            <Select value={language}
                                    options={languageOptions}
                                    onChange={onLanguageChange}
                            />
                        </Flex>
                    </Form.Item>
                    <Form.Item label={t("Theme")} name="theme">
                        <Flex>
                            <Select value={theme}
                                    options={themeOptions}
                                    onChange={onThemeChange}/>
                        </Flex>
                    </Form.Item>
                    <Form.Item label={t("Config Directory")}>
                        <Flex>
                            <Input value={configDirectory}
                                   disabled/>
                            <Button type="default"
                                    onClick={onOpenConfigDirClick}
                            >
                                {t("Open")}
                            </Button>
                        </Flex>
                    </Form.Item>
                    <Form.Item label={t("Import Config")}>
                        <Button type="dashed"
                                {...ButtonLayout}
                                onClick={onImportConfigClick}>
                            {t("Open")}
                        </Button>
                    </Form.Item>
                    <Form.Item label={t("Cache Directory")}>
                        <Flex>
                            <Search value={cacheDirectory}
                                    enterButton={<FolderAddOutlined/>}
                                    onSearch={onSelectCacheDirClick}
                            />
                            <Button type="default"
                                    onClick={onOpenCacheDirClick}
                            >
                                {t("Open")}
                            </Button>
                        </Flex>
                    </Form.Item>
                    <Form.Item label={t("Clear Current Cache")}>
                        <Button type="dashed"
                                danger
                                {...ButtonLayout}
                                onClick={onClearCacheClick}>
                            {t("Clean")}
                        </Button>
                    </Form.Item>
                    <Form.Item label={t("Clipboard Monitor")}>
                        <Switch checked={clipboardMonitor}
                                onChange={onClipboardMonitorChange}
                        />
                    </Form.Item>
                </Form>
            </Card>
            <Card title={t("Framework Settings")}
                  style={{marginBottom: "10px"}}
            >
                <Form {...SettingLayout}>
                    <Form.Item label={t("Release channel")}>
                        <Flex>
                            <Select value={releaseChannel}
                                    options={releaseChannelOptions}
                                    onChange={onReleaseChannelChange}
                            />
                        </Flex>
                    </Form.Item>
                    <Form.Item label={t("UE4SS")}>
                        <Select<Ue4ssSetting> onChange={onUe4ssChange}
                                value={ue4ss}
                                options={[
                                    {
                                        value: UE4SS_SETTING_ENABLED,
                                        label: t("Enable"),
                                    },
                                    {
                                        value: UE4SS_SETTING_DISABLED,
                                        label: t("Disable"),
                                    },
                                ]}/>
                    </Form.Item>
                    <Form.Item label={t("Dev Tools")}>
                        <Button type="dashed"
                                {...ButtonLayout}
                                onClick={onDevToolsClick}>
                            {t("Open Dev Tools")}
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        </>
    )
}
