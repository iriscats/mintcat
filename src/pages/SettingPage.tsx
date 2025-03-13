import React from 'react';
import {open} from '@tauri-apps/plugin-dialog'
import {
    Form,
    Input,
    Select,
    Card, message,
} from 'antd';
import {AppContext} from "../AppContext.ts";
import {FolderAddOutlined} from "@ant-design/icons";
import Search from "antd/es/input/Search";


const LanguageOptions = [
    {value: 'en', label: 'English'},
    {value: 'zh', label: 'Chinese'},
];

const ThemeOptions = [
    {value: 'Light', label: 'Light'},
];


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
    }

    private async onLanguageChange() {
        this.context.setting.language = this.appSettingFormRef.current?.getFieldValue("language");
        await this.context.saveSettings();
    }

    private async onThemeChange() {
        this.context.setting.guiTheme = this.appSettingFormRef.current?.getFieldValue("theme");
        await this.context.saveSettings();
    }

    private async onOAuthChange(e: any) {
        this.context.setting.modioOAuth = e.target.value;
        await this.context.saveSettings();
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
                          labelCol={{span: 6}}
                          wrapperCol={{span: 16}}
                          style={{maxWidth: 600}}
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
                    </Form>
                </Card>

                <Card title="User Authentication"
                      style={{marginBottom: "10px"}}
                >
                    <Form ref={this.userSettingFormRef}
                          labelCol={{span: 6}}
                          wrapperCol={{span: 16}}
                          style={{maxWidth: 600}}
                    >
                        <Form.Item label="mod.io key" name="oauth">
                            <Input onChange={this.onOAuthChange}/>
                        </Form.Item>
                    </Form>
                </Card>

                <Card title="Game Settings"
                >
                    <Form ref={this.gameSettingFormRef}
                          labelCol={{span: 6}}
                          wrapperCol={{span: 16}}
                          style={{maxWidth: 600}}
                    >
                        <Form.Item label="Game Path" name="gamePath">
                            <Search placeholder={"FSD-WindowsNoEditor.pak"}
                                    enterButton={<FolderAddOutlined/>}
                                    onSearch={this.onGamePathClick}
                            />
                        </Form.Item>
                    </Form>
                </Card>


            </div>
        );
    }
}

export default SettingPage;