import React from 'react';
import {t} from "i18next";
import {WebviewWindow} from "@tauri-apps/api/webviewWindow";
import {Button, Flex, Tabs} from 'antd';

import {ModioApi} from "@/apis/ModioApi.ts";
import {ProfileTreeGroupType} from "@/vm/config/ProfileList.ts";
import {LocalTab} from "@/dialogs/AddModDialog/LocalTab.tsx";
import {ModioTab} from "@/dialogs/AddModDialog/ModioTab.tsx";
import {HomeViewModel} from "@/vm/HomeViewModel.ts";
import {BasePage} from "@/pages/IBasePage.ts";
import {emit, once} from "@tauri-apps/api/event";
import {ClipboardApi} from "@/apis/ClipboardApi.ts";


export async function openWindow(text: string = ""): Promise<void> {
    const vm = await HomeViewModel.getInstance();

    const window = new WebviewWindow('add-mod-dialog', {
        url: '/add_mod_dialog',
        width: 400,
        height: 480,
        title: t("Add Mod"),
        dragDropEnabled: true,
    });

    await window.once('tauri://created', () => {
        const groupOptions = Array.from(vm.ActiveProfile?.groupNameMap)
            .map(([key, value]) => ({
                label: value,
                value: key,
            }));

        window.emit('init-data', {key: 'value'});
    });

    await window.onDragDropEvent(
        (event) => {
            if (event.payload.type === 'drop') {
                console.log('User dropped', event.payload);
            }
        }
    );

    await once('add-mod-dialog-close', async () => {
        console.log("add-mod-dialog-close");
        await window.close();
    })

}

async function onClipboardChange(text: string) {
    if (!text) {
        return;
    }
    const links = text.split("\n");
    for (const link of links) {
        if (!ModioApi.parseModLinks(link)) {
            return;
        }
    }

    openWindow(text);
}

ClipboardApi.setClipboardWatcher(onClipboardChange).then();


interface AddModDialogStates {
    tabActiveKey?: string;
}

type InputCallback = (name: string) => void;

enum AddModType {
    MODIO = "mod.io",
    LOCAL = "local"
}


export class AddModDialog extends BasePage<any, AddModDialogStates> {

    private readonly modioFormRef: any = React.createRef();
    private readonly localFormRef: any = React.createRef();

    private callback?: InputCallback;

    public constructor(props: any, context: AddModDialogStates) {
        super(props, context);

        this.state = {
            tabActiveKey: AddModType.LOCAL,
        }

        this.handleOk = this.handleOk.bind(this);
        this.handleCancel = this.handleCancel.bind(this);
        this.setCallback = this.setCallback.bind(this);
        this.handleTabChange = this.handleTabChange.bind(this);
    }

    public setCallback(callback: any = undefined) {
        this.callback = callback;
        return this;
    }

    private async handleOk() {
        switch (this.state.tabActiveKey) {
            case AddModType.MODIO:
                this.modioFormRef.current?.submit();
                break;
            case AddModType.LOCAL:
                this.localFormRef.current?.submit();
                break;
            default:
                break;
        }

        this.callback?.call(this);
    }

    private async handleCancel() {
        await emit('add-mod-dialog-close');
    }

    private handleTabChange(key: string) {
        this.setState({
            tabActiveKey: key
        });
    }

    componentDidMount() {
        this.hookWindowResized();
    }

    render() {
        return (
            <div style={{
                background: "white",
                height: window.innerHeight - 40,
                padding: "20px 30px"
            }}>
                <Tabs defaultActiveKey={this.state.tabActiveKey}
                      activeKey={this.state.tabActiveKey}
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
                                  children: <ModioTab ref={this.modioFormRef}/>,
                              }
                          ]
                      }>
                </Tabs>
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


