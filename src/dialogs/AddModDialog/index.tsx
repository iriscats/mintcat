import React from 'react';
import {t} from "i18next";
import {Button, Flex, Form, message, Select, Tabs} from 'antd';
import {emit, listen} from "@tauri-apps/api/event";
import {LocalTab} from "@/dialogs/AddModDialog/LocalTab.tsx";
import {ModioTab} from "@/dialogs/AddModDialog/ModioTab.tsx";
import {BasePage} from "@/pages/IBasePage.ts";
import {ProfileTreeGroupType} from "@/vm/config/ProfileList.ts";
import {autoBind} from "@/utils/ReactUtils.ts";

export enum AddModType {
    MODIO = "mod.io",
    LOCAL = "local"
}

interface AddModDialogStates {
    addModType?: string;
    groupOptions?: any[];
    groupId?: number;
    loading?: boolean;
    text?: string;
}

export interface AddModDialogResult {
    addModType?: string;
    groupId?: number;
    list?: string[];
}

export class AddModDialog extends BasePage<any, AddModDialogStates> {

    private readonly modioFormRef: any = React.createRef();
    private readonly localFormRef: any = React.createRef();

    public constructor(props: any) {
        super(props);

        this.state = {
            addModType: AddModType.LOCAL,
            groupId: ProfileTreeGroupType.LOCAL,
        }
    }


    @autoBind
    private async handleOk() {
        let list = [];
        switch (this.state.addModType) {
            case AddModType.MODIO: {
                list = this.modioFormRef.current?.submit();
            }
                break;
            case AddModType.LOCAL: {
                list = this.localFormRef.current?.submit();
            }
                break;
            default:
                break;
        }

        console.log(list);

        if (list.length === 0) {
            message.warning(t("Please input mod"));
            return;
        }

        await emit('add-mod-dialog-ok', {
            groupId: this.state.groupId,
            addModType: this.state.addModType,
            list: list
        });
    }

    @autoBind
    private async handleCancel() {
        await emit('add-mod-dialog-close');
    }

    @autoBind
    private handleTabChange(key: string) {
        let groupId = 0;
        switch (key) {
            case AddModType.MODIO:
                groupId = ProfileTreeGroupType.MODIO;
                break;
            case AddModType.LOCAL:
                groupId = ProfileTreeGroupType.LOCAL;
                break;
            default:
                break;
        }
        this.setState({
            groupId: groupId,
            addModType: key
        });
    }

    @autoBind
    private onSelectGroupChange(value: number) {
        this.setState({
            groupId: value
        });
    }

    componentDidMount() {
        this.hookWindowResized();

        const initDataStr = localStorage.getItem('add-mod-dialog-init-data');
        const initData = JSON.parse(initDataStr);
        this.setState({
            addModType: initData.addModType,
            groupId: initData.groupId,
            groupOptions: initData.groupOptions,
            text: initData.text
        });

        listen<any>("add-mod-dialog-init-data", async (event) => {
            console.log("AddModDialog init event", event);
            this.setState({
                addModType: event.payload.addModType,
                groupId: event.payload.groupId,
                groupOptions: event.payload.groupOptions,
                text: event.payload.text
            });
        }).then();
    }

    render() {
        return (
            <div style={{
                background: "white",
                height: window.innerHeight - 40,
                padding: "20px 30px"
            }}>
                <Tabs activeKey={this.state.addModType}
                      onChange={this.handleTabChange}
                      items={
                          [
                              {
                                  key: AddModType.LOCAL,
                                  label: t("Local"),
                                  children: <LocalTab ref={this.localFormRef}/>,
                              },
                              {
                                  key: AddModType.MODIO,
                                  label: 'mod.io',
                                  children: <ModioTab ref={this.modioFormRef}
                                                      text={this.state.text}/>,
                              }
                          ]
                      }>
                </Tabs>
                <Form layout="vertical">
                    <Form.Item name="groupId"
                               label={t("Group")}
                               rules={[{required: true}]}>
                        <Flex>
                            <Select value={this.state.groupId}
                                    options={this.state.groupOptions}
                                    onChange={this.onSelectGroupChange}
                            />
                        </Flex>
                    </Form.Item>
                </Form>
                <Flex gap={"large"}
                      style={{
                          alignItems: "center",
                          alignContent: "center",
                          justifyContent: "center",
                      }}
                >
                    <Button type={"primary"}
                            style={{width: 100}}
                            onClick={this.handleOk}
                    >
                        OK
                    </Button>
                    <Button style={{width: 100}}
                            onClick={this.handleCancel}
                    >
                        Cancel
                    </Button>
                </Flex>
            </div>
        );
    }
}


