import React from "react";
import {Avatar, Badge, Button, Flex, Image, List, Popover} from "antd";
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
import {IntegrateApi} from "../apis/IntegrateApi.ts";
import {ModioApi} from "../apis/ModioApi.ts";
import {MessageBox} from "./MessageBox.ts";
import {CacheApi} from "../apis/CacheApi.ts";
import {AppViewModel} from "../vm/AppViewModel.ts";
import {emit, once} from "@tauri-apps/api/event";


interface TitleBarState {
    profileUrl?: string,
    username?: string,
    modioId: number
}

class TitleBar extends React.Component<any, TitleBarState> {

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

    private async onThemeClick(value: string) {
        const vm = await AppViewModel.getInstance();
        vm.setting.guiTheme = value;
        localStorage.setItem('theme', value);
        await vm.saveSettings();
        await emit("theme-change");
    }

    componentDidMount(): void {
        once("title-bar-load-avatar", () => {
            this.loadAvatar().then();
        }).then();
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