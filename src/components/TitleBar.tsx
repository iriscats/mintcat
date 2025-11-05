import React from "react";
import {Avatar, Badge, Button, Flex, Image} from "antd";
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
import UserSettingDialog from "../dialogs/UserSettingDialog/index.tsx";


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
        if (await IntegrateApi.installMods())
            await IntegrateApi.launchGame();
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
                       <Button type={"text"}
                               icon={<SkinOutlined/>}
                               disabled
                       />
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