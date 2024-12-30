import React from 'react';
import {
    Button,
    Cascader,
    DatePicker,
    Form,
    Input,
    InputNumber,
    Mentions,
    Select,
    TreeSelect,
    Segmented, Card,
} from 'antd';

const {RangePicker} = DatePicker;


class SettingPage extends React.Component {

    public constructor(props: any, context: any) {
        super(props, context);
    }


    render() {
        const [form] = Form.useForm();
        return (
            <Card>
                <div
                    id="scrollableDiv"
                    style={{
                        height: 450,
                        overflow: 'auto',
                    }}
                >
                    <Form
                        form={form}
                        style={{maxWidth: 600}}
                        initialValues={{variant: 'filled'}}
                    >
                        <Form.Item label="Form variant" name="variant">
                            <Segmented options={['outlined', 'filled', 'borderless']}/>
                        </Form.Item>

                        <Form.Item label="Input" name="Input" rules={[{required: true, message: 'Please input!'}]}>
                            <Input/>
                        </Form.Item>

                        <Form.Item
                            label="InputNumber"
                            name="InputNumber"
                            rules={[{required: true, message: 'Please input!'}]}
                        >
                            <InputNumber style={{width: '100%'}}/>
                        </Form.Item>

                        <Form.Item
                            label="TextArea"
                            name="TextArea"
                            rules={[{required: true, message: 'Please input!'}]}
                        >
                            <Input.TextArea/>
                        </Form.Item>

                        <Form.Item
                            label="Mentions"
                            name="Mentions"
                            rules={[{required: true, message: 'Please input!'}]}
                        >
                            <Mentions/>
                        </Form.Item>

                        <Form.Item
                            label="Select"
                            name="Select"
                            rules={[{required: true, message: 'Please input!'}]}
                        >
                            <Select/>
                        </Form.Item>

                        <Form.Item
                            label="Cascader"
                            name="Cascader"
                            rules={[{required: true, message: 'Please input!'}]}
                        >
                            <Cascader/>
                        </Form.Item>

                        <Form.Item
                            label="TreeSelect"
                            name="TreeSelect"
                            rules={[{required: true, message: 'Please input!'}]}
                        >
                            <TreeSelect/>
                        </Form.Item>

                        <Form.Item
                            label="DatePicker"
                            name="DatePicker"
                            rules={[{required: true, message: 'Please input!'}]}
                        >
                            <DatePicker/>
                        </Form.Item>

                        <Form.Item
                            label="RangePicker"
                            name="RangePicker"
                            rules={[{required: true, message: 'Please input!'}]}
                        >
                            <RangePicker/>
                        </Form.Item>

                        <Form.Item wrapperCol={{offset: 6, span: 16}}>
                            <Button type="primary" htmlType="submit">
                                Submit
                            </Button>
                        </Form.Item>
                    </Form>
                </div>
            </Card>
        );
    }
}

export default SettingPage;