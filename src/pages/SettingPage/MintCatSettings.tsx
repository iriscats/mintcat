import {t} from "i18next";
import React from "react";
import {openPath} from "@tauri-apps/plugin-opener";
import {open} from "@tauri-apps/plugin-dialog";
import i18n from "@/locales/i18n.ts";
import {IntegrateApi} from "@/apis/IntegrateApi.ts";
import {CacheApi} from "@/apis/CacheApi.ts";
import {StorageAPI} from "@/storage";
import {Button, Card, Flex, Form, Input, message, Select} from "antd";
import {FolderAddOutlined} from "@ant-design/icons";
import Search from "antd/es/input/Search";
import {ButtonLayout, SettingLayout} from "@/pages/SettingPage/Layout.ts";
import {emitEvent, emitVoidEvent, useEventListener} from "@/events";


export function MintCatSettings() {

    const languageOptions = [
        {value: 'en', label: t("English")},
        {value: 'zh', label: t('Chinese')},
    ];

    const themeOptions = [
        {value: 'Light', label: t('Purple')},
        {value: 'Blue', label: t('Blue')},
        {value: 'Dark', label: t('Dark')},
        {value: 'Pink', label: t('Pink')},
    ];

    const [language, setLanguage] = React.useState<string>("en");
    const [theme, setTheme] = React.useState<string>("Light");
    const [configDirectory, setConfigDirectory] = React.useState<string>("");
    const [cacheDirectory, setCacheDirectory] = React.useState<string>("");
    const [ue4ss, setUe4ss] = React.useState<string>("");

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
            setCacheDirectory(result);
            const settings = await StorageAPI.getSettings();
            await settings.setCachePath(result);
            CacheApi.clearCache();
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

    const onUe4ssChange = async (value: string) => {
        setUe4ss(value);
        if (value === "Custom") {
            message.warning(t("Disclaimer: The installation of the Custom mode UE4SS will be taken over by the user, and all consequences are the user's sole responsibility."));
        }
        const settings = await StorageAPI.getSettings();
        await settings.setValue('ue4ss', value);
    }

    const onDevToolsClick = async () => {
        await IntegrateApi.openDevTools();
    }

    const onClearCacheClick = async () => {
        if (await CacheApi.cleanOldCacheFiles()) {
            message.success(t("Clean Cache Success"));
        }
    }

    const onImportConfigClick = async () => {
        await emitVoidEvent("config-manage-dialog-open");
    }

    // ✅ 使用 useEventListener 自动管理清理
    useEventListener("theme-change", (theme) => {
        setTheme(theme);
    });

    React.useEffect(() => {
        const fetchData = async () => {
            const settings = await StorageAPI.getSettings();
            setLanguage(await settings.getLanguage());
            setTheme(await settings.getGuiTheme());
            setConfigDirectory(await settings.getConfigPath());
            setCacheDirectory(await settings.getCachePath());
            const ue4ssValue = await settings.getValue('ue4ss');
            setUe4ss(ue4ssValue ? ue4ssValue : "UE4SS-Lite");
        }
        fetchData().then();
    }, []);

    return (
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
                <Form.Item label={t("Old Version Mint Cache")}>
                    <Button type="dashed"
                            {...ButtonLayout}
                            onClick={onClearCacheClick}>
                        {t("Clean")}
                    </Button>
                </Form.Item>
                <Form.Item label={t("Dev Tools")}>
                    <Button type="dashed"
                            {...ButtonLayout}
                            onClick={onDevToolsClick}>
                        {t("Open Dev Tools")}
                    </Button>
                </Form.Item>
                <Form.Item label={t("UE4SS")}>
                    <Select onChange={onUe4ssChange}
                            value={ue4ss}
                            options={[
                                {
                                    value: "UE4SS-Lite",
                                    label: "UE4SS-Lite",
                                },
                                {
                                    value: "Custom",
                                    label: "Custom",
                                },
                            ]}/>
                </Form.Item>
            </Form>
        </Card>
    )
}
