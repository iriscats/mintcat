import React from "react";
import {Avatar, Badge, Button, Flex, Image, Popconfirm} from "antd";
import {t} from "i18next";
import {
    BellOutlined,
    PlayCircleOutlined,
    QuestionCircleOutlined,
    SkinOutlined,
    UserOutlined
} from '@ant-design/icons';
import packageJson from '../../package.json';
import {AppContext} from "../AppContext.ts";
import {IntegrateApi} from "../apis/IntegrateApi.ts";
import {once} from "@tauri-apps/api/event";
import {ModioApi} from "../apis/ModioApi.ts";
import {MessageBox} from "./MessageBox.ts";
import {CacheApi} from "../apis/CacheApi.ts";


interface TitleBarState {
    profileUrl?: string,
    username: string,
}

class TitleBar extends React.Component<any, TitleBarState> {

    declare context: React.ContextType<typeof AppContext>;
    static contextType = AppContext;


    public constructor(props: any, context: any) {
        super(props, context);

        this.state = {
            profileUrl: "",
            username: "",
        }

        this.onLaunchGameClick = this.onLaunchGameClick.bind(this);
    }

    private async onLaunchGameClick() {
        await this.context.installMods();
        await once<string>('install-success', async () => {
            await IntegrateApi.launchGame();
        });
    }

    private async loadAvatar() {
        const userInfo = await ModioApi.getUserInfo();
        if (userInfo) {
            const url = await CacheApi.cacheImage(userInfo.avatar.thumb_50x50);
            this.setState({
                profileUrl: url,
                username: userInfo.username,
            })
        }
    }

    componentDidMount(): void {
        this.loadAvatar().then(() => {
        });
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
                <Flex gap="middle" justify={"flex-end"} wrap>
                    <Button
                        type="primary"
                        onClick={this.onLaunchGameClick}
                        className={"ant-header-start-button"}>
                        <PlayCircleOutlined/>
                        <span>
                            <b>
                                {t("Launch Game")}
                            </b>
                        </span>
                    </Button>
                    <span>
                        <Badge size={"small"}
                               count={0}
                        >
                            <BellOutlined/>
                        </Badge>
                    </span>
                    <span>
                    <Popconfirm
                        placement="bottom"
                        title={"开发中"}
                        description={"未完成的功能，敬请期待"}
                        okText="Yes"
                        cancelText="No"
                    >
                        <SkinOutlined/>
                    </Popconfirm>
                    </span>
                    <span>
                        <QuestionCircleOutlined/>
                    </span>
                    <Avatar className={"app-header-avatar"}
                            icon={<UserOutlined/>}
                            src={<img src={this.state.profileUrl} alt="avatar"/>}
                            onClick={async () => {
                                await MessageBox.confirm({
                                    title: t("User Info"),
                                    content: <>
                                        {this.state.username}
                                    </>
                                })
                            }}
                    />
                </Flex>
            </Flex>
        );
    }
}

export default TitleBar;