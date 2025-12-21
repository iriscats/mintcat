import React from "react";
import {Avatar, Badge, Button, Dropdown, Flex, Image, List, Popover, Space, Tooltip, message} from "antd";
import {t} from "i18next";
import {
    BellOutlined,
    EllipsisOutlined,
    PlayCircleOutlined,
    QuestionCircleOutlined,
    SkinOutlined,
    UserOutlined
} from '@ant-design/icons';
import {open} from "@tauri-apps/plugin-shell";
import packageJson from '../../package.json';
import {IntegrateApi} from "../apis/IntegrateApi.ts";
import UserSettingDialog from "../dialogs/UserSettingDialog/index.tsx";
import {emit} from "@tauri-apps/api/event";
import {StorageAPI} from "@/storage";
import {TaskManager} from "@/tasks/TaskManager.ts";

const items = [

];

class TitleBar extends React.Component<any, any> {

    private readonly userSettingDialogRef: React.RefObject<UserSettingDialog>;

    public constructor(props: any) {
        super(props);

        this.userSettingDialogRef = React.createRef();

        this.onLaunchGameClick = this.onLaunchGameClick.bind(this);
    }

    private async onOpenWikiClick() {
        await open("https://mintcat.v1st.net");
    }

    private async onLaunchGameClick() {
        try {
            // Submit installation task
            const taskId = await IntegrateApi.installMods();

            // Setup progress listener
            const taskManager = TaskManager.getInstance();
            const unlisten = await taskManager.onTaskUpdated((task) => {
                if (task.id === taskId) {
                    // Update status bar with progress
                    emit("status-bar-percent", task.progress).catch(console.error);

                    if (task.status === 'processing') {
                        console.log(`[TitleBar] Installation progress: ${task.progress}%`);
                    }
                }
            });

            // Wait for task to complete
            const result = await taskManager.waitForTask(taskId, 120000); // 2 min timeout

            // Cleanup listener
            unlisten();

            if (result.status === 'completed') {
                // Installation succeeded, launch game
                await emit("status-bar-percent", 0);
                await IntegrateApi.launchGame();
            } else if (result.status === 'failed') {
                await emit("status-bar-percent", 0);
                message.error(`${t("Installation Failed")}: ${result.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('[TitleBar] Installation failed:', error);
            await emit("status-bar-percent", 0);
            message.error(t("Installation Failed"));
        }
    }

    private async onThemeClick(value: string) {
        const storage = await StorageAPI.getSettings();
        await storage.setGuiTheme(value);
        localStorage.setItem('theme', value);
        await emit("theme-change", value);
    }

    componentDidMount(): void {
        // Avatar loading is now handled by UserSettingDialog
    }

    render() {
        return (
            <Flex justify={"space-between"}>
                <Flex gap="middle" wrap>
                    <Image
                        width={30}
                        preview={false}
                        src="icon.ico"
                    />
                    <h1>
                        <b>
                            <span style={{
                                backgroundImage: "linear-gradient(to right, blue, purple)",
                                backgroundClip: "text",
                                color: "transparent",
                            }}>MINT</span>
                            <span style={{
                                backgroundImage: "linear-gradient(to right, purple, deeppink)",
                                backgroundClip: "text",
                                color: "transparent",
                            }}>CAT</span>
                        </b>
                    </h1>
                    <span style={{fontSize: "12px", color: "gray", lineHeight: "54px", verticalAlign: "bottom"}}>
                        v{packageJson.version}
                    </span>
                </Flex>
                <Flex gap="small" justify={"flex-end"} wrap>
                    <span>
                        <Space.Compact block>
                            <Button type="primary"
                                onClick={this.onLaunchGameClick}
                                className={"ant-header-start-button"}
                            >
                                <PlayCircleOutlined/>
                                <span>
                                    <b>
                                        深岩银河
                                        {/*{t("Launch Game")}*/}
                                    </b>
                                </span>
                            </Button>
                            <Tooltip title="Tooltip">
                                <Button type="primary" 
                                    className={"ant-header-start-button"}
                                    icon={<EllipsisOutlined />} 
                                />
                            </Tooltip>
                        </Space.Compact>
                    </span>
                    <span>
                        <Badge size={"small"}
                               count={0}
                        >
                         <Button type={"text"}
                                 icon={<BellOutlined/>}
                         />
                        </Badge>
                    </span>
                    <span>
                    <Popover
                        placement="bottom"
                        title={""}
                        content={
                            <List grid={{gutter: 16, column: 3}}
                                  dataSource={[
                                      {key: 'Light', title: t('Light'), color: "#F5F8FF"},
                                      {key: 'Dark', title: t('Dark'), color: "black"},
                                      {key: 'Pink', title: t('Pink'), color: "rgba(237,65,146,0.2)"},
                                  ]}
                                  renderItem={(item) => (
                                      <List.Item>
                                          <Button className={"app-title-bar-skin-button"}
                                                  title={item.title}
                                                  style={{backgroundColor: item.color}}
                                                  onClick={async () => {
                                                      await this.onThemeClick(item.key)
                                                  }}
                                          >
                                          </Button>
                                      </List.Item>
                                  )}
                            >
                            </List>
                        }
                    >
                       <Button type={"text"}
                               icon={<SkinOutlined/>}
                       />
                    </Popover>
                    </span>
                    <span>
                        <Button type={"text"}
                                icon={<QuestionCircleOutlined/>}
                                onClick={this.onOpenWikiClick}
                        />
                    </span>
                    <Avatar className={"app-header-avatar"}
                            icon={<UserOutlined/>}
                            onClick={() => {
                                this.userSettingDialogRef.current?.show();
                            }}
                    />
                </Flex>
                <UserSettingDialog ref={this.userSettingDialogRef}/>
            </Flex>
        );
    }
}

export default TitleBar;