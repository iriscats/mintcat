import React from 'react';
import {t} from "i18next";
import {open} from '@tauri-apps/plugin-dialog'
import {openPath} from '@tauri-apps/plugin-opener';
import {appCacheDir} from "@tauri-apps/api/path";
import {Form, Input, Select, Card, message, Button, Flex} from 'antd';
import {FolderAddOutlined} from "@ant-design/icons";
import Search from "antd/es/input/Search";

import {AppContext} from "../AppContext.ts";
import {IntegrateApi} from "../apis/IntegrateApi.ts";
import {ConfigApi} from "../apis/ConfigApi.ts";
import {CacheApi} from "../apis/CacheApi.ts";

const SettingLayout = {
    labelCol: {span: 7},
    wrapperCol: {span: 16},
    style: {maxWidth: 700},
};

const ButtonLayout = {
    style: {width: 468},
};

class SettingPage extends React.Component<any, any> {

    private languageOptions = [
        {value: 'en', label: t("English")},
        {value: 'zh', label: t('Chinese')},
    ];

    private themeOptions = [
        {value: 'Light', label: t('Light')},
        {value: 'Dark', label: t('Dark')},
    ];

    declare context: React.ContextType<typeof AppContext>;
    static contextType = AppContext;

    private readonly appSettingFormRef: any = React.createRef();
    private readonly userSettingFormRef: any = React.createRef();
    private readonly gameSettingFormRef: any = React.createRef();

    public constructor(props: any, context: any) {
        super(props, context);

        this.onGamePathClick = this.onGamePathClick.bind(this);
        this.onOAuthChange = this.onOAuthChange.bind(this);
        this.onLanguageChange = this.onLanguageChange.bind(this);
        this.onThemeChange = this.onThemeChange.bind(this);
        this.onDevToolsClick = this.onDevToolsClick.bind(this);
        this.onOpenConfigDirClick = this.onOpenConfigDirClick.bind(this);
        this.onOpenCacheDirClick = this.onOpenCacheDirClick.bind(this);
        this.onSelectCacheDirClick = this.onSelectCacheDirClick.bind(this);
        this.onFindGamePathClick = this.onFindGamePathClick.bind(this);
    }

    private async onOpenConfigDirClick() {
        await openPath(await ConfigApi.getConfigPath());
    }

    private async onOpenCacheDirClick() {
        if (this.context.setting.cachePath) {
            await openPath(this.context.setting.cachePath);
        } else {
            await openPath(await appCacheDir());
        }
    }

    private async onSelectCacheDirClick() {
        const result = await open({
            directory: true
        });
        if (result) {
            await this.context.saveSettings();
        }
    }

    private async onFindGamePathClick() {
        const path = await IntegrateApi.findGamePak();
        if (path) {
            this.context.setting.drgPakPath = path;
            await this.context.saveSettings();
        } else {
            message.error(t("Can't find FSD-WindowsNoEditor.pak"));
        }
    }

    private async onLanguageChange() {
        const language = this.appSettingFormRef.current?.getFieldValue("language");
        this.context.setting.language = language;
        await this.context.saveSettings();
        localStorage.setItem('lang', language);
        window.location.reload();
    }

    private async onThemeChange() {
        this.context.setting.guiTheme = this.appSettingFormRef.current?.getFieldValue("theme");
        await this.context.saveSettings();
        await this.context.loadTheme();
    }

    private async onOAuthChange(e: any) {
        this.context.setting.modioOAuth = e.target.value;
        await this.context.saveSettings();
    }

    private async onDevToolsClick() {
        await IntegrateApi.openDevTools();
    }

    private async onClearCacheClick() {
        if (await CacheApi.cleanOldCacheFiles()) {
            message.success(t("Clean cache success"));
        }
    }

    private async onGamePathClick() {
        const result = await open({
            filters: [{
                name: 'FSD-WindowsNoEditor',
                extensions: ['pak'],
            }],
            multiple: false,
        });
        if (result) {
            if (result.endsWith("FSD-WindowsNoEditor.pak")) {
                this.gameSettingFormRef.current?.setFieldsValue({
                    gamePath: result,
                });
                this.context.setting.drgPakPath = result;
                await this.context.saveSettings();
            } else {
                message.error(t("Please select FSD-WindowsNoEditor.pak"));
            }
        }
    }

    componentDidMount(): void {
        this.appSettingFormRef.current?.setFieldsValue({
            language: this.context.setting.language,
            theme: this.context.setting.guiTheme,
            configDirectory: this.context.setting.configPath,
            cacheDirectory: this.context.setting.cachePath,
        });
        this.userSettingFormRef.current?.setFieldsValue({
            oauth: this.context.setting.modioOAuth,
        });
        this.gameSettingFormRef.current?.setFieldsValue({
            gamePath: this.context.setting.drgPakPath,
        });
    }

    render() {

        return (
            <div
                id="scrollableDiv"
                style={{
                    height: window.innerHeight - 81,
                    overflow: 'auto',
                    padding: '30px',
                }}
            >
                <Card title={t("MintCat Settings")}
                      style={{marginBottom: "10px"}}
                >
                    <Form ref={this.appSettingFormRef}
                          {...SettingLayout}
                    >
                        <Form.Item label={t("Language")} name="language">
                            <Select options={this.languageOptions}
                                    onChange={this.onLanguageChange}
                            />
                        </Form.Item>
                        <Form.Item label={t("Theme")} name="theme">
                            <Select options={this.themeOptions}
                                    onChange={this.onThemeChange}/>
                        </Form.Item>
                        <Form.Item label={t("Config Directory")}>
                            <Flex>
                                <Input value={this.context.setting.configPath}
                                       disabled/>
                                <Button type="default"
                                        onClick={this.onOpenConfigDirClick}
                                >
                                    {t("Open")}
                                </Button>
                            </Flex>
                        </Form.Item>
                        <Form.Item label={t("Cache Directory")}>
                            <Flex>
                                <Search value={this.context.setting.cachePath}
                                        enterButton={<FolderAddOutlined/>}
                                        onSearch={this.onSelectCacheDirClick}
                                />
                                <Button type="default"
                                        onClick={this.onOpenCacheDirClick}
                                >
                                    {t("Open")}
                                </Button>
                            </Flex>
                        </Form.Item>
                        <Form.Item label={t("Old Version Mint Cache")}>
                            <Button type="dashed"
                                    {...ButtonLayout}
                                    onClick={this.onClearCacheClick}>
                                {t("Clean")}
                            </Button>
                        </Form.Item>
                        <Form.Item label={t("Dev Tools")}>
                            <Button type="dashed"
                                    {...ButtonLayout}
                                    onClick={this.onDevToolsClick}>
                                {t("Open Dev Tools")}
                            </Button>
                        </Form.Item>
                    </Form>
                </Card>

                <Card title={t("User Authentication")}
                      style={{marginBottom: "10px"}}
                >
                    <Form ref={this.userSettingFormRef}
                          {...SettingLayout}
                    >
                        <Form.Item label={t("mod.io key")} name="oauth">
                            <Input onChange={this.onOAuthChange}/>
                        </Form.Item>
                    </Form>
                </Card>

                <Card title={t("Game Settings")}
                >
                    <Form ref={this.gameSettingFormRef}
                          {...SettingLayout}
                    >
                        <Form.Item label={t("Game Path")}>
                            <Flex>
                                <Search placeholder={"FSD-WindowsNoEditor.pak"}
                                        value={this.context.setting.drgPakPath}
                                        enterButton={<FolderAddOutlined/>}
                                        onSearch={this.onGamePathClick}
                                />
                                <Button type="default"
                                        onClick={this.onFindGamePathClick}
                                >
                                    {t("Auto Find")}
                                </Button>
                            </Flex>
                        </Form.Item>
                    </Form>
                </Card>


            </div>
        );
    }
}

export default SettingPage;