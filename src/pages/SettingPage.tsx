import React from 'react';
import {
    Form,
    Input,
    Select,
    Card,
} from 'antd';

class SettingPage extends React.Component<any, any> {

    public constructor(props: any, context: any) {
        super(props, context);
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
                    <Form
                        labelCol={{span: 6}}
                        wrapperCol={{span: 16}}
                        style={{maxWidth: 600}}
                    >
                        <Form.Item label="Language" name="Input">
                            <Select/>
                        </Form.Item>
                        <Form.Item label="Theme" name="Input">
                            <Select/>
                        </Form.Item>
                    </Form>
                </Card>

                <Card title="User Authentication"
                      style={{marginBottom: "10px"}}
                >
                    <Form
                        labelCol={{span: 6}}
                        wrapperCol={{span: 16}}
                        style={{maxWidth: 600}}
                    >
                        <Form.Item label="mod.io key" name="Input">
                            <Input/>
                        </Form.Item>
                    </Form>
                </Card>

                <Card title="Game Settings"
                >
                    <Form
                        labelCol={{span: 6}}
                        wrapperCol={{span: 16}}
                        style={{maxWidth: 600}}
                    >
                        <Form.Item label="Game Path" name="Input">
                            <Input/>
                        </Form.Item>
                    </Form>
                </Card>


            </div>
        );
    }
}

export default SettingPage;