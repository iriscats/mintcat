import React from 'react';
import {Form, Modal, Select, Tabs} from 'antd';
import TextArea from "antd/es/input/TextArea";
import {FolderAddOutlined} from "@ant-design/icons";
import {ModListPageContext} from "../AppContext.ts";
import {ProfileTreeGroupType} from "../vm/config/ProfileList.ts";
import Search from "antd/es/input/Search";
import {open} from "@tauri-apps/plugin-dialog";

interface AddModDialogStates {
    isModalOpen?: boolean;
    tabActiveKey?: string;
    groupOptions?: any[];
    groupId?: number;
    url?: string;
    loading?: boolean;
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
            loading: false,
            tabActiveKey: AddModType.MODIO,
        }

        this.show = this.show.bind(this);
        this.clearData = this.clearData.bind(this);
        this.handleOk = this.handleOk.bind(this);
        this.handleCancel = this.handleCancel.bind(this);
        this.setCallback = this.setCallback.bind(this);
        this.handleTabChange = this.handleTabChange.bind(this);
        this.onSelectPathClick = this.onSelectPathClick.bind(this);
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

        this.modioFormRef.current?.setFieldsValue({
            modLinks: url,
            groupId
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

    private async clearData() {
        console.log("clear data");
        this.modioFormRef.current?.resetFields();
        this.localFormRef.current?.resetFields();
        this.modioFormRef.current?.setFieldsValue({
            modLinks: ""
        });
        this.localFormRef.current?.setFieldsValue({
            path: ""
        });
        this.setState({
            url: "",
            isModalOpen: false
        });
    }

    private async handleOk() {
        this.setState({
            loading: true
        })
        if (this.state.tabActiveKey === AddModType.MODIO) {
            const links = this.state.url.split("\n");
            for (const link of links) {
                await this.context.addModFromUrl(link, this.state.groupId);
            }
        } else {
            await this.context.addModFromPath(this.state.url, this.state.groupId);
        }
        await this.clearData();
        this.callback?.call(this);
        this.setState({
            loading: false
        })
    }

    private async handleCancel() {
        await this.clearData();
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

    private async onSelectPathClick() {
        const result = await open({
            filters: [{
                name: '*',
                extensions: ['pak', 'zip'],
            }],
            multiple: false,
        });
        if (result) {

            this.localFormRef.current?.setFieldsValue({
                path: result,
            });

            this.setState({
                url: result,
            });
        }
    }

    private updateGroupList() {
        if (!this.context?.ActiveProfile) {
            return;
        }
        this.setState({
            groupOptions: Array.from(this.context?.ActiveProfile?.groupNameMap)
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
                   mask={false}
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
                                      <Form ref={this.modioFormRef}
                                            layout="vertical"
                                            disabled={this.state.loading}
                                            initialValues={{
                                                modLinks: this.state.url,
                                                groupId: this.state.groupId
                                            }}
                                      >
                                          <Form.Item name="modLinks"
                                                     label="Mod Links"
                                                     rules={[{required: true}]}
                                          >
                                              <TextArea value={this.state.url}
                                                        onChange={(e) => {
                                                            this.setState({
                                                                url: e.target.value
                                                            })
                                                        }}
                                                        rows={4}
                                              />
                                          </Form.Item>
                                          <Form.Item name="groupId"
                                                     label="Group"
                                                     rules={[{required: true}]}
                                          >
                                              <Select options={this.state.groupOptions}/>
                                          </Form.Item>
                                      </Form>
                                  </>,
                              },
                              {
                                  key: AddModType.LOCAL,
                                  label: 'Local',
                                  children: <>
                                      <Form ref={this.localFormRef}
                                            layout="vertical"
                                            disabled={this.state.loading}
                                            initialValues={{
                                                path: this.state.url,
                                                groupId: this.state.groupId
                                            }}
                                      >
                                          <Form.Item name="path" label="Path" rules={[{required: true}]}>
                                              <Search enterButton={<FolderAddOutlined/>}
                                                      onSearch={this.onSelectPathClick}/>
                                          </Form.Item>
                                          <Form.Item name="groupId" label="Group" rules={[{required: true}]}>
                                              <Select options={this.state.groupOptions}/>
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