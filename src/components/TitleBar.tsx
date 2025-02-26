import React from "react";
import {Avatar, Button, Flex, Image, Popconfirm, Tag} from "antd";
import {
    BellOutlined,
    CloudSyncOutlined,
    PlayCircleOutlined,
    QuestionCircleOutlined,
    SkinOutlined,
    UserOutlined
} from '@ant-design/icons';
import packageJson from '../../package.json';

class TitleBar extends React.Component {

    public constructor(props: any, context: any) {
        super(props, context);
    }

    private async onLaunchGameClick() {
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
                    <BellOutlined/>
                    <Popconfirm
                        placement="bottom"
                        title={"text"}
                        description={"description"}
                        okText="Yes"
                        cancelText="No"
                    >
                        <SkinOutlined/>
                    </Popconfirm>
                    <QuestionCircleOutlined/>
                    <Avatar className={"app-header-avatar"}
                            icon={<UserOutlined/>}
                    />
                </Flex>
            </Flex>
        )
            ;
    }
}

export default TitleBar;