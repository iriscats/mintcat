import React from 'react';
import {t} from "i18next";
import {Button, Flex, Form, message, Select, Tabs} from 'antd';
import {emitEvent, emitVoidEvent, listenEvent, type UnlistenFn} from "@/events";
import {LocalTab} from "@/dialogs/AddModDialog/LocalTab.tsx";
import {ModioTab} from "@/dialogs/AddModDialog/ModioTab.tsx";
import {BasePage} from "@/pages/IBasePage.ts";
import {ProfileTreeGroupType} from "@/storage/db/Schema.ts";
import {autoBind} from "@/utils/ReactUtils.ts";
import {DialogProfileService} from "@/services/DialogProfileService.ts";
import {AppInitializer} from "@/core/AppInitializer";
import {registerIoC} from "@/core/IoCRegistration.ts";

export enum AddModType {
    MODIO = "mod.io",
    LOCAL = "local"
}

interface AddModDialogStates {
    addModType?: string;
    groupOptions?: any[];
    groupFolders?: any[]; // Store full folder data with folderType
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
    private dialogProfileService = new DialogProfileService();

    private readonly modioFormRef: any = React.createRef();
    private readonly localFormRef: any = React.createRef();
    private unlistenInitData?: UnlistenFn;

    public constructor(props: any) {
        super(props);

        this.state = {
            addModType: AddModType.LOCAL,
            groupId: ProfileTreeGroupType.LOCAL,
            groupOptions: [],
            groupFolders: [],
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

        if (list.length === 0) {
            message.warning(t("Please input mod"));
            return;
        }

        await emitEvent('add-mod-dialog-ok', {
            groupId: this.state.groupId!,
            addModType: this.state.addModType!,
            list: list
        });
    }

    @autoBind
    private async handleCancel() {
        await emitVoidEvent('add-mod-dialog-close');
    }

    @autoBind
    private handleTabChange(key: string) {
        let groupId = 0;
        let targetFolderType = "";

        switch (key) {
            case AddModType.MODIO:
                targetFolderType = "modio";
                break;
            case AddModType.LOCAL:
                targetFolderType = "local";
                break;
            default:
                break;
        }

        // Find the actual folder ID by folderType
        if (this.state.groupFolders && targetFolderType) {
            const folder = this.state.groupFolders.find(f => f.folderType === targetFolderType);
            if (folder) {
                groupId = folder.id;
            }
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

    @autoBind
    private async loadGroupOptions() {
        const profileFolderList = await this.dialogProfileService.getActiveProfileFolders();

        this.setState({
            groupFolders: profileFolderList, // Store full folder data
            groupOptions: profileFolderList.map((item) => {
                return {
                    label: item.name,
                    value: item.id,
                }
            }),
        });
    }

    async componentDidMount(): Promise<void> {
        // Ensure core is initialized (multi-window support)
        // Register ViewModels if not already registered
        registerIoC();

        if (!AppInitializer.isCoreReady()) {
            console.log('[AddModDialog] Core not ready, initializing...');
            await AppInitializer.initializeCore();
        }

        this.hookWindowResized();

        // Load group options
        await this.loadGroupOptions();

        // Load dialog data
        const initDataStr = localStorage.getItem('add-mod-dialog-init-data');
        const initData = JSON.parse(initDataStr);

        // Resolve groupId: if it's an enum constant, find the actual folder ID
        let resolvedGroupId = initData.groupId;
        if (this.state.groupFolders) {
            // Check if groupId is an enum constant (1=MODIO, 2=LOCAL)
            if (initData.groupId === ProfileTreeGroupType.MODIO) {
                const folder = this.state.groupFolders.find(f => f.folderType === "modio");
                if (folder) resolvedGroupId = folder.id;
            } else if (initData.groupId === ProfileTreeGroupType.LOCAL) {
                const folder = this.state.groupFolders.find(f => f.folderType === "local");
                if (folder) resolvedGroupId = folder.id;
            }
        }

        this.setState({
            addModType: initData.addModType,
            groupId: resolvedGroupId,
            text: initData.text,
        });

        // ✅ Listen for dialog data updates (when window is reused)
        this.unlistenInitData = await listenEvent("add-mod-dialog-init-data", async (payload) => {
            console.log("AddModDialog init event", payload);
            // Reload group options to ensure they're up-to-date
            await this.loadGroupOptions();

            // Resolve groupId: if it's an enum constant, find the actual folder ID
            let resolvedGroupId = payload.groupId;
            if (this.state.groupFolders) {
                if (payload.groupId === ProfileTreeGroupType.MODIO) {
                    const folder = this.state.groupFolders.find(f => f.folderType === "modio");
                    if (folder) resolvedGroupId = folder.id;
                } else if (payload.groupId === ProfileTreeGroupType.LOCAL) {
                    const folder = this.state.groupFolders.find(f => f.folderType === "local");
                    if (folder) resolvedGroupId = folder.id;
                }
            }

            this.setState({
                addModType: payload.addModType,
                groupId: resolvedGroupId,
                text: payload.text
            });
        });
    }

    componentWillUnmount(): void {
        // ✅ 清理监听器
        if (this.unlistenInitData) {
            this.unlistenInitData();
        }
    }

    render() {
        return (
            <div className="add-mod-dialog"
                 style={{
                     height: window.innerHeight - 40
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
