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
import {open} from "@tauri-apps/plugin-shell";
import packageJson from '../../package.json';
import {AppContext} from "../AppContext.ts";
import {IntegrateApi} from "../apis/IntegrateApi.ts";
import {ModioApi} from "../apis/ModioApi.ts";
import {MessageBox} from "./MessageBox.ts";
import {CacheApi} from "../apis/CacheApi.ts";
import {AppViewModel} from "../vm/AppViewModel.ts";


interface TitleBarState {
    profileUrl?: string,
    username?: string,
    modioId: number
}

class TitleBar extends React.Component<any, TitleBarState> {

    declare context: React.ContextType<typeof AppContext>;
    static contextType = AppContext;


    public constructor(props: any, context: any) {
        super(props, context);

        this.state = {
            username: "",
            modioId: 0,
        }

        this.onLaunchGameClick = this.onLaunchGameClick.bind(this);
    }

    private async onOpenWikiClick() {
        await open("https://mintcat.v1st.net");
    }

    private async onLaunchGameClick() {
        if (await IntegrateApi.installMods())
            await IntegrateApi.launchGame();
    }

    private async loadAvatar() {
        const vm = await AppViewModel.getInstance();
        if (!await vm.checkOauth()) {
            return;
        }

        const userInfo = await ModioApi.getUserInfo();
        if (userInfo) {
            const url = await CacheApi.cacheImage(userInfo.avatar.thumb_50x50);
            vm.setting.modioUid = userInfo.id;
            this.setState({
                profileUrl: url,
                username: userInfo.username,
                modioId: userInfo.id
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
                        title={"In development"}
                        description={"未完成的功能，敬请期待"}
                        okText="Yes"
                        cancelText="No"
                    >
                        <SkinOutlined/>
                    </Popconfirm>
                    </span>
                    <span>
                        <Button type={"text"}
                                icon={<QuestionCircleOutlined/>}
                                onClick={this.onOpenWikiClick}
                        />
                    </span>
                    <Avatar className={"app-header-avatar"}
                            icon={<UserOutlined/>}
                            src={
                                this.state.profileUrl &&
                                <img src={this.state.profileUrl} alt="avatar"/>
                            }
                            onClick={async () => {
                                await MessageBox.confirm({
                                    title: t("User Info"),
                                    content: <>
                                        <div>ID: {this.state.modioId}</div>
                                        <div>{t("Username")}: {this.state.username}</div>
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