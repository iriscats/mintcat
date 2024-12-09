import React from 'react';
import {Form, Input, Modal, Tabs, TabsProps} from 'antd';
import TextArea from "antd/es/input/TextArea";
import {FolderAddOutlined} from "@ant-design/icons";


class AddModDialog extends React.Component<any, any> {

    public constructor(props: any, context: any) {
        super(props, context);

        this.state = {
            isModalOpen: false,
        }

        this.show = this.show.bind(this);
        this.handleOk = this.handleOk.bind(this);
        this.handleCancel = this.handleCancel.bind(this);
    }

    public show() {
        this.setState({isModalOpen: true});
    }

    private handleOk() {
        this.parseModLinks("https://mod.io/g/drg/m/10iron-will-recharge-10-minutes");
        this.setState({isModalOpen: false});
    }

    private handleCancel() {
        this.setState({isModalOpen: false});
    }


    private parseModLinks(link: string) {
        let regex = new RegExp('^https://mod\.io/g/drg/m/([^/#]+)(?:#(\\d+)(?:/(\\d+))?)?$');
        let match = link.match(regex);
        if (match !== null) {
            let name_id = match[1];
            let mod_id = match[2];
            let modify_id = match[3];

            console.log(`name_id: ${name_id}, mod_id: ${mod_id}, modify_id: ${modify_id}`);

        }
    }

    items: TabsProps['items'] = [
        {
            key: '1',
            label: 'mod.io',
            children: <>
                <Form layout="vertical">
                    <Form.Item name="modLinks" label="Mod Links" rules={[{required: true}]}>
                        <TextArea rows={4}/>
                    </Form.Item>
                </Form>
            </>,
        },
        {
            key: '2',
            label: 'Local',
            children: <>
                <Form layout="vertical">
                    <Form.Item name="path" label="Path" rules={[{required: true}]}>
                        <Input addonAfter={<FolderAddOutlined/>}/>
                    </Form.Item>
                </Form>
            </>,
        }
    ];

    render() {
        return (
            <Modal title="Add Mod"
                   open={this.state.isModalOpen}
                   onOk={this.handleOk}
                   onCancel={this.handleCancel}
            >
                <Tabs defaultActiveKey="1" items={this.items}>
                </Tabs>
            </Modal>
        );
    }
}

export default AddModDialog;