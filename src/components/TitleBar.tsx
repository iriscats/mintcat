import React from "react";
import {Avatar, Badge, Button, Flex, Image, Popover, Space, Tooltip, message} from "antd";
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
import {StorageAPI} from "@/storage";
import {emitEvent, listenEvent, UnlistenFn} from "@/events";
import { taskQueueAPI } from "tauri-plugin-task-queue-api";
import UserSettingDialog from "../dialogs/UserSettingDialog/index.tsx";
import {SelectGameDialog, SelectGameDialogRef} from "@/dialogs/SelectGameDialog/index.tsx";
import {CacheApi} from "@/apis/CacheApi.ts";
import {ModioApi} from "@/apis/modio";


class TitleBar extends React.Component<any, any> {

    private readonly userSettingDialogRef: React.RefObject<UserSettingDialog>
    private readonly selectGameDialogRef: React.RefObject<SelectGameDialogRef>
    private unlistenActiveGameChange: UnlistenFn | undefined;

    public constructor(props: any) {
        super(props);

        this.userSettingDialogRef = React.createRef();
        this.selectGameDialogRef = React.createRef();

        this.state = {
            gameName: "未选择",
            avatarUrl: null
        };

        this.onLaunchGameClick = this.onLaunchGameClick.bind(this);
    }

    private async loadActiveGame() {
        try {
            const gameDAO = await StorageAPI.getGames();
            const activeGame = await gameDAO.getActiveGame();
            if (activeGame) {
                this.setState({ gameName: activeGame.displayName });
            }
        } catch (e) {
            console.error("Failed to load active game", e);
        }
    }

    private async loadUserAvatar() {
        try {
            const userInfo = await ModioApi.getUserInfo();
            if (userInfo) {
                const avatarUrl = await CacheApi.loadAvatar(userInfo.id);
                if (avatarUrl) {
                    this.setState({ avatarUrl });
                }
            }
        } catch (e) {
            console.error("Failed to load user avatar", e);
        }
    }

    private async onOpenWikiClick() {
        await open("https://www.mintcat.work");
    }

    private async onLaunchGameClick() {
        try {
            // Submit installation task
            const taskId = await IntegrateApi.installMods();

            // Wait for task to complete (no timeout)
            const result = await taskQueueAPI.waitForTaskCompletion(taskId);

            if (result.status === 'completed') {
                // Installation succeeded, launch game
                await IntegrateApi.launchGame();
            } else if (result.status === 'failed') {
                message.error(`${t("Installation Failed")}: ${result.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('[TitleBar] Installation failed:', error);
            message.error(t("Installation Failed"));
        }
    }

    private async onThemeClick(value: string) {
        const storage = await StorageAPI.getSettings();
        await storage.setGuiTheme(value);
        localStorage.setItem('theme', value);
        await emitEvent("theme-change", value as 'Light' | 'Dark' | 'Pink');
    }

    async componentDidMount() {
        this.loadActiveGame();
        this.loadUserAvatar();
        this.unlistenActiveGameChange = await listenEvent('active-game-change', (game) => {
            this.setState({ gameName: game.displayName });
        });
    }

    componentWillUnmount() {
        if (this.unlistenActiveGameChange) {
            this.unlistenActiveGameChange();
        }
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
                                <span style={{marginTop: "-1px"}}>
                                    <b>
                                        {this.state.gameName}
                                    </b>
                                </span>
                            </Button>
                            <Tooltip title="Tooltip">
                                <Button type="primary" 
                                    className={"ant-header-start-button"}
                                    icon={<EllipsisOutlined />} 
                                    onClick={() => this.selectGameDialogRef.current?.show()}
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
                            <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16}}>
                                {[
                                    {key: 'Light', title: t('Light'), color: "#804bcc"},
                                    {key: 'Blue', title: t('Blue'), color: "#F5F8FF"},
                                    {key: 'Dark', title: t('Dark'), color: "black"},
                                    {key: 'Pink', title: t('Pink'), color: "rgba(237,65,146,0.2)"},
                                ].map((item) => (
                                    <Button
                                        key={item.key}
                                        className={"app-title-bar-skin-button"}
                                        title={item.title}
                                        style={{backgroundColor: item.color}}
                                        onClick={async () => {
                                            await this.onThemeClick(item.key);
                                        }}
                                    />
                                ))}
                            </div>
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
                            src={this.state.avatarUrl}
                            onClick={() => {
                                this.userSettingDialogRef.current?.show();
                            }}
                    />
                </Flex>
                <UserSettingDialog ref={this.userSettingDialogRef}/>
                <SelectGameDialog ref={this.selectGameDialogRef}/>
            </Flex>
        );
    }
}

export default TitleBar;
