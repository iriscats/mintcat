import React from "react";
import {Avatar, Badge, Button, Flex, Image, Popconfirm} from "antd";
import {
    BellOutlined,
    CloudSyncOutlined,
    PlayCircleOutlined,
    QuestionCircleOutlined,
    SkinOutlined,
    UserOutlined
} from '@ant-design/icons';
import packageJson from '../../package.json';
import {AppContext} from "../AppContext.ts";

class TitleBar extends React.Component {

    declare context: React.ContextType<typeof AppContext>;
    static contextType = AppContext;


    public constructor(props: any, context: any) {
        super(props, context);

        this.onLaunchGameClick = this.onLaunchGameClick.bind(this);
    }

    private async onLaunchGameClick() {
        await this.context.installMods();
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
                        Launch Game
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
                            title={"text"}
                            description={"description"}
                            okText="Yes"
                            cancelText="No"
                        >
                            <SkinOutlined/>
                        </Popconfirm>
                    </span>
                    <span>
                        <QuestionCircleOutlined/>
                    </span>
                    <Popconfirm
                        placement="bottomRight"
                        title={"text"}
                        description={"description"}
                        okText="Yes"
                        cancelText="No"
                    >
                        <Avatar className={"app-header-avatar"}
                                icon={<UserOutlined/>}
                        />
                    </Popconfirm>
                </Flex>
            </Flex>
        )
            ;
    }
}

export default TitleBar;