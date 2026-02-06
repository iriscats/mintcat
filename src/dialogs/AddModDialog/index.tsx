import React from 'react';
import {t} from "i18next";
import {Button, Flex, Form, message, Select, Tabs} from 'antd';
import {emitEvent, emitVoidEvent, listenEvent, type UnlistenFn} from "@/events";
import {LocalTab} from "@/dialogs/AddModDialog/LocalTab.tsx";
import {OnlineTab} from "@/dialogs/AddModDialog/OnlineTab.tsx";
import {BasePage} from "@/pages/IBasePage.ts";
import {autoBind} from "@/utils/ReactUtils.ts";
import {DialogProfileService} from "@/services/DialogProfileService.ts";
import {AppInitializer} from "@/core/AppInitializer";
import {registerIoC} from "@/core/IoCRegistration.ts";

export enum AddModType {
    ONLINE = "online",
    LOCAL = "local"
}

const LAST_SELECTED_GROUP_KEY = 'add-mod-dialog-last-group-id';

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
    private dialogProfileService = new DialogProfileService();

    private readonly onlineFormRef: any = React.createRef();
    private readonly localFormRef: any = React.createRef();
    private unlistenInitData?: UnlistenFn;

    public constructor(props: any) {
        super(props);

        this.state = {
            addModType: AddModType.LOCAL,
            groupId: 0,
            groupOptions: [],
        }
    }


    @autoBind
    private async handleOk() {
        let list = [];
        switch (this.state.addModType) {
            case AddModType.ONLINE: {
                list = this.onlineFormRef.current?.submit();
                break;
            }
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

    /**
     * 解析 groupId：优先使用传入的 groupId（如果在文件夹列表中存在），
     * 否则使用缓存的上次选择，最后回退到第一个文件夹
     */
    private resolveGroupId(groupId: number | undefined, folders: any[]): number {
        // 1. 如果传入了有效的 groupId 且在当前文件夹列表中存在，直接使用
        if (groupId && folders?.some(f => f.id === groupId)) {
            return groupId;
        }

        // 2. 尝试使用缓存的上次选择
        const cachedId = parseInt(localStorage.getItem(LAST_SELECTED_GROUP_KEY) || '0');
        if (cachedId && folders?.some(f => f.id === cachedId)) {
            return cachedId;
        }

        // 3. 回退到第一个文件夹
        if (folders && folders.length > 0) {
            return folders[0].id;
        }

        return 0;
    }

    @autoBind
    private handleTabChange(key: string) {
        this.setState({
            addModType: key
        });
    }

    @autoBind
    private onSelectGroupChange(value: number) {
        this.setState({
            groupId: value
        });
        // 缓存用户选择的文件夹
        localStorage.setItem(LAST_SELECTED_GROUP_KEY, String(value));
    }

    @autoBind
    private async loadGroupOptions() {
        const profileFolderList = await this.dialogProfileService.getActiveProfileFolders();

        this.setState({
            groupOptions: profileFolderList.map((item) => {
                return {
                    label: item.name,
                    value: item.id,
                }
            }),
        });

        // Return the folder list for immediate use (since setState is async)
        return profileFolderList;
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

        // Load group options and get the folder list immediately
        const groupFolders = await this.loadGroupOptions();

        // Load dialog data
        const initDataStr = localStorage.getItem('add-mod-dialog-init-data');
        const initData = JSON.parse(initDataStr);

        // Resolve groupId: use provided groupId > cached last selection > first folder
        const resolvedGroupId = this.resolveGroupId(initData.groupId, groupFolders);

        this.setState({
            addModType: initData.addModType,
            groupId: resolvedGroupId,
            text: initData.text,
        });

        // ✅ Listen for dialog data updates (when window is reused)
        this.unlistenInitData = await listenEvent("add-mod-dialog-init-data", async (payload) => {
            console.log("AddModDialog init event", payload);
            // Reload group options to ensure they're up-to-date
            const groupFolders = await this.loadGroupOptions();

            const resolvedGroupId = this.resolveGroupId(payload.groupId, groupFolders);

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
                                  key: AddModType.ONLINE,
                                  label: t("Online"),
                                  children: <OnlineTab ref={this.onlineFormRef}
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
