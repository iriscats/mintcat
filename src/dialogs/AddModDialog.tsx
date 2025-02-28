import React from 'react';
import {Form, Input, Modal, Select, Tabs, TabsProps} from 'antd';
import TextArea from "antd/es/input/TextArea";
import {FolderAddOutlined} from "@ant-design/icons";
import {ModListPageContext} from "../AppContext.ts";
import {ProfileTreeGroupType} from "../vm/config/ProfileList.ts";

interface AddModDialogStates {
    isModalOpen?: boolean;
    tabActiveKey?: string;
    groupOptions?: any[];
    groupId?: number;
    url?: string;
}

type InputCallback = (name: string) => void;

enum AddModType {
    MODIO = "mod.io",
    LOCAL = "local"
}


class AddModDialog extends React.Component<any, AddModDialogStates> {

    declare context: React.ContextType<typeof ModListPageContext>;
    static contextType = ModListPageContext;

    private readonly modioFormRef: any = React.createRef();

    private readonly localFormRef: any = React.createRef();

    private callback?: InputCallback;

    public constructor(props: any, context: AddModDialogStates) {
        super(props, context);

        this.state = {
            isModalOpen: false,
            tabActiveKey: AddModType.MODIO,
        }

        this.show = this.show.bind(this);
        this.handleOk = this.handleOk.bind(this);
        this.handleCancel = this.handleCancel.bind(this);
        this.setCallback = this.setCallback.bind(this);
        this.handleTabChange = this.handleTabChange.bind(this);
    }

    public setValue(groupId: number = 0, url: string = undefined) {
        let tabActiveKey = AddModType.MODIO;
        switch (groupId) {
            case ProfileTreeGroupType.MODIO:
                tabActiveKey = AddModType.MODIO;
                break;
            case ProfileTreeGroupType.LOCAL:
                tabActiveKey = AddModType.LOCAL;
                break;
            case 0:
                groupId = this.state.groupOptions[0].value;
                break;
            default:
                break;
        }
        this.setState({
            groupId,
            tabActiveKey,
            url
        });
        this.updateGroupList();
        return this;
    }

    public setCallback(callback: any = undefined) {
        this.callback = callback;
        return this;
    }

    public show() {
        this.setState({
            isModalOpen: true
        });
    }

    private async handleOk() {
        // https://mod.io/g/drg/m/10iron-will-recharge-10-minutes
        const values = this.modioFormRef.current?.getFieldsValue();
        if (this.state.tabActiveKey === AddModType.MODIO) {
            const links = values["modLinks"].toString().split("\n");
            for (const link of links) {
                await this.context.addModFromUrl(link, this.state.groupId);
            }
        } else {
            await this.context.addModFromPath(values["path"], this.state.groupId);
        }
        this.setState({
            isModalOpen: false
        });
        this.modioFormRef.current?.setFieldsValue({});
        this.callback?.call(this);
    }

    private handleCancel() {
        this.modioFormRef.current?.setFieldsValue({});
        this.setState({
            isModalOpen: false
        });
    }

    private handleTabChange(key: string) {
        if (key === AddModType.MODIO) {
            this.setState({
                groupId: ProfileTreeGroupType.MODIO,
                tabActiveKey: key
            })
        } else if (key === "local") {
            this.setState({
                groupId: ProfileTreeGroupType.LOCAL,
                tabActiveKey: key
            })
        } else {
            this.setState({
                tabActiveKey: key
            })
        }
    }

    private updateGroupList() {
        this.setState({
            groupOptions: Array.from(this.context.ActiveProfile.groupNameMap)
                .map(([key, value]) => ({
                    label: value,
                    value: key,
                }))
        })
    }

    componentDidMount() {
        this.updateGroupList();
    }

    render() {
        return (
            <Modal title="Add Mod"
                   open={this.state.isModalOpen}
                   onOk={this.handleOk}
                   onCancel={this.handleCancel}
            >
                <Tabs defaultActiveKey={this.state.tabActiveKey}
                      activeKey={this.state.tabActiveKey}
                      onChange={this.handleTabChange}
                      items={
                          [
                              {
                                  key: AddModType.MODIO,
                                  label: 'mod.io',
                                  children: <>
                                      <Form ref={this.modioFormRef} layout="vertical">
                                          <Form.Item name="modLinks"
                                                     label="Mod Links"
                                                     rules={[{required: true}]}
                                          >
                                              <TextArea defaultValue={this.state.url}
                                                        value={this.state.url}
                                                        rows={4}
                                              />
                                          </Form.Item>
                                          <Form.Item name="group"
                                                     label="Group"
                                                     rules={[{required: true}]}
                                          >
                                              <Select defaultValue={this.state.groupId}
                                                      options={this.state.groupOptions}/>
                                          </Form.Item>
                                      </Form>
                                  </>,
                              },
                              {
                                  key: AddModType.LOCAL,
                                  label: 'Local',
                                  children: <>
                                      <Form ref={this.localFormRef} layout="vertical">
                                          <Form.Item name="path" label="Path" rules={[{required: true}]}>
                                              <Input addonAfter={<FolderAddOutlined/>}/>
                                          </Form.Item>
                                          <Form.Item name="group" label="Group" rules={[{required: true}]}>
                                              <Select defaultValue={this.state.groupId}
                                                      options={this.state.groupOptions}/>
                                          </Form.Item>
                                      </Form>
                                  </>,
                              }
                          ]
                      }>
                </Tabs>
            </Modal>
        );
    }
}

export default AddModDialog;