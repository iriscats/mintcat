import {t} from "i18next";
import React from "react";
import {openPath} from "@tauri-apps/plugin-opener";
import {open} from "@tauri-apps/plugin-dialog";
import i18n from "@/locales/i18n.ts";
import {IntegrateApi} from "@/apis/IntegrateApi.ts";
import {CacheApi} from "@/apis/CacheApi.ts";
import {ConfigApi} from "@/apis/ConfigApi.ts";
import {Button, Card, Flex, Form, Input, message, Select} from "antd";
import {FolderAddOutlined} from "@ant-design/icons";
import Search from "antd/es/input/Search";
import {ButtonLayout, SettingLayout} from "@/pages/SettingPage/Layout.ts";
import {AppViewModel} from "@/vm/AppViewModel.ts";
import {emit} from "@tauri-apps/api/event";

const languageOptions = [
    {value: 'en', label: t("English")},
    {value: 'zh', label: t('Chinese')},
];

const themeOptions = [
    {value: 'Light', label: t('Light')},
    {value: 'Dark', label: t('Dark')},
    {value: 'Pink', label: t('Pink')},
];

export function MintCatSettings() {

    const [language, setLanguage] = React.useState<string>("en");
    const [theme, setTheme] = React.useState<string>("Light");
    const [configDirectory, setConfigDirectory] = React.useState<string>("");
    const [cacheDirectory, setCacheDirectory] = React.useState<string>("");

    const onOpenConfigDirClick = async () => {
        await openPath(await ConfigApi.getConfigPath());
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
            const vm = await AppViewModel.getInstance();
            vm.setting.cachePath = result;
            await vm.saveSettings();
        }
    }

    const onLanguageChange = async (value: string) => {
        setLanguage(value);
        await i18n.changeLanguage(value);
        const vm = await AppViewModel.getInstance();
        vm.setting.language = value;
        await vm.saveSettings();
    }

    const onThemeChange = async (value: string) => {
        setTheme(value);
        const vm = await AppViewModel.getInstance();
        vm.setting.guiTheme = value;
        localStorage.setItem('theme', value);
        await vm.saveSettings();
        await emit("theme-change");
    }

    const onDevToolsClick = async () => {
        await IntegrateApi.openDevTools();
    }

    const onClearCacheClick = async () => {
        if (await CacheApi.cleanOldCacheFiles()) {
            message.success(t("Clean Cache Success"));
        }
    }

    const onUninstallClick = async () => {
        await IntegrateApi.uninstallMods();
    }


    React.useEffect(() => {
        const fetchData = async () => {
            const vm = await AppViewModel.getInstance();
            setLanguage(vm.setting.language);
            setTheme(vm.setting.guiTheme);
            setConfigDirectory(vm.setting.configPath);
            setCacheDirectory(vm.setting.cachePath);
        }
        fetchData().then();
    });


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
                <Form.Item label={t("Uninstall Mods")}>
                    <Button type="dashed"
                            {...ButtonLayout}
                            onClick={onUninstallClick}>
                        {t("Delete")}
                    </Button>
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
            </Form>
        </Card>
    )
}
