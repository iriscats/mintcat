import React from 'react';
import {
    Form,
    Input,
    Select,
    Card,
} from 'antd';
import {AppContext} from "../AppContext.ts";


const LanguageOptions = [
    {value: 'en', label: 'English'},
    {value: 'zh', label: 'Chinese'},
];

const ThemeOptions = [
    {value: 'default', label: 'Default'},
];


class SettingPage extends React.Component<any, any> {

    declare context: React.ContextType<typeof AppContext>;
    static contextType = AppContext;

    private readonly appSettingFormRef: any = React.createRef();
    private readonly userSettingFormRef: any = React.createRef();
    private readonly gameSettingFormRef: any = React.createRef();

    public constructor(props: any, context: any) {
        super(props, context);
    }

    componentDidMount(): void {
        console.log(this.context.setting);
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
                            <Select options={LanguageOptions}/>
                        </Form.Item>
                        <Form.Item label="Theme" name="theme">
                            <Select options={ThemeOptions}/>
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
                            <Input/>
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
                            <Input/>
                        </Form.Item>
                    </Form>
                </Card>


            </div>
        );
    }
}

export default SettingPage;