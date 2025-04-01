import React from 'react';
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


const LanguageOptions = [
    {value: 'en', label: 'English'},
    {value: 'zh', label: 'Chinese'},
];

const ThemeOptions = [
    {value: 'Light', label: 'Light'},
];

const settingLayout = {
    labelCol: {span: 7},
    wrapperCol: {span: 16},
    style: {maxWidth: 700},
};

const buttonLayout = {
    style: {width: 468},
};

class SettingPage extends React.Component<any, any> {

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
            message.error("Can't find FSD-WindowsNoEditor.pak");
        }
    }

    private async onLanguageChange() {
        this.context.setting.language = this.appSettingFormRef.current?.getFieldValue("language");
        await this.context.saveSettings();
    }

    private async onThemeChange() {
        const theme = this.appSettingFormRef.current?.getFieldValue("theme");
        
        this.context.setting.guiTheme = theme;
        await this.context.saveSettings();
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
            message.success("Clean cache success");
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
                message.error("Please select FSD-WindowsNoEditor.pak");
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
                <Card title="MintCat Settings"
                      style={{marginBottom: "10px"}}
                >
                    <Form ref={this.appSettingFormRef}
                          {...settingLayout}
                    >
                        <Form.Item label="Language" name="language">
                            <Select options={LanguageOptions}
                                    onChange={this.onLanguageChange}
                            />
                        </Form.Item>
                        <Form.Item label="Theme" name="theme">
                            <Select options={ThemeOptions}
                                    onChange={this.onThemeChange}/>
                        </Form.Item>
                        <Form.Item label="Config Directory">
                            <Flex>
                                <Input value={this.context.setting.configPath}
                                       disabled/>
                                <Button type="default"
                                        onClick={this.onOpenConfigDirClick}
                                >
                                    Open
                                </Button>
                            </Flex>
                        </Form.Item>
                        <Form.Item label="Cache Directory">
                            <Flex>
                                <Search value={this.context.setting.cachePath}
                                        enterButton={<FolderAddOutlined/>}
                                        onSearch={this.onSelectCacheDirClick}
                                />
                                <Button type="default"
                                        onClick={this.onOpenCacheDirClick}
                                >
                                    Open
                                </Button>
                            </Flex>
                        </Form.Item>
                        <Form.Item label="Old Version Mint Cache">
                            <Button type="dashed"
                                    {...buttonLayout}
                                    onClick={this.onClearCacheClick}>
                                Clean
                            </Button>
                        </Form.Item>
                        <Form.Item label="Dev Tools">
                            <Button type="dashed"
                                    {...buttonLayout}
                                    onClick={this.onDevToolsClick}>
                                Open / Close Dev Tools
                            </Button>
                        </Form.Item>
                    </Form>
                </Card>

                <Card title="User Authentication"
                      style={{marginBottom: "10px"}}
                >
                    <Form ref={this.userSettingFormRef}
                          {...settingLayout}
                    >
                        <Form.Item label="mod.io key" name="oauth">
                            <Input onChange={this.onOAuthChange}/>
                        </Form.Item>
                    </Form>
                </Card>

                <Card title="Game Settings"
                >
                    <Form ref={this.gameSettingFormRef}
                          {...settingLayout}
                    >
                        <Form.Item label="Game Path">
                            <Flex>
                                <Search placeholder={"FSD-WindowsNoEditor.pak"}
                                        value={this.context.setting.drgPakPath}
                                        enterButton={<FolderAddOutlined/>}
                                        onSearch={this.onGamePathClick}
                                />
                                <Button type="default"
                                        onClick={this.onFindGamePathClick}
                                >
                                    Auto Find
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