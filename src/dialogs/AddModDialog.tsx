import React from 'react';
import {Form, Input, Modal, Tabs, TabsProps} from 'antd';
import TextArea from "antd/es/input/TextArea";
import {FolderAddOutlined} from "@ant-design/icons";
import ModioApi from "../apis/ModioApi.ts";

interface AddModDialogStates {
    isModalOpen?: boolean;
    tabActiveKey?: string;
}


class AddModDialog extends React.Component<any, AddModDialogStates> {

    private readonly modioFormRef: any = React.createRef();

    private readonly localFormRef: any = React.createRef();

    public constructor(props: any, context: AddModDialogStates) {
        super(props, context);

        this.state = {
            isModalOpen: false,
            tabActiveKey: "modio"
        }

        this.show = this.show.bind(this);
        this.handleOk = this.handleOk.bind(this);
        this.handleCancel = this.handleCancel.bind(this);
    }

    public show() {
        this.setState({
            isModalOpen: true
        });
    }

    private async handleOk() {
        // https://mod.io/g/drg/m/10iron-will-recharge-10-minutes
        if (this.state.tabActiveKey === "modio") {
            const values = this.modioFormRef.current.getFieldsValue();
            const modInfo = this.parseModLinks(values["modLinks"]);
            const resp = await ModioApi.getModByName(modInfo.nameId);
            console.log(resp);
            this.setState({isModalOpen: false});
        } else {
            const values = this.localFormRef.current.getFieldsValue();
        }
    }

    private handleCancel() {
        this.setState({isModalOpen: false});
    }

    private parseModLinks(link: string) {
        let regex = new RegExp('^https://mod\.io/g/drg/m/([^/#]+)(?:#(\\d+)(?:/(\\d+))?)?$');
        let match = link.match(regex);
        if (match !== null) {
            let nameId = match[1];
            let modId = match[2];
            let modifyId = match[3];

            console.log(`name_id: ${nameId}, mod_id: ${modId}, modify_id: ${modifyId}`);
            return {nameId, modId, modifyId};
        }
    }

    private tabsItems: TabsProps['items'] = [
        {
            key: 'modio',
            label: 'mod.io',
            children: <>
                <Form ref={this.modioFormRef} layout="vertical">
                    <Form.Item name="modLinks" label="Mod Links" rules={[{required: true}]}>
                        <TextArea rows={4}/>
                    </Form.Item>
                </Form>
            </>,
        },
        {
            key: 'local',
            label: 'Local',
            children: <>
                <Form ref={this.localFormRef} layout="vertical">
                    <Form.Item name="path" label="Path" rules={[{required: true}]}>
                        <Input addonAfter={<FolderAddOutlined/>}/>
                    </Form.Item>
                </Form>
            </>,
        }
    ];

    private render() {
        return (
            <Modal title="Add Mod"
                   open={this.state.isModalOpen}
                   onOk={this.handleOk}
                   onCancel={this.handleCancel}
            >
                <Tabs defaultActiveKey={this.state.tabActiveKey} items={this.tabsItems}>
                </Tabs>
            </Modal>
        );
    }
}

export default AddModDialog;