import React from "react";
import {Avatar, Flex, Image, Popconfirm} from "antd";
import {BellOutlined, CloudSyncOutlined, QuestionCircleOutlined, SkinOutlined, UserOutlined} from '@ant-design/icons';
import packageJson from '../../package.json';

class TitleBar extends React.Component {

    public constructor(props: any, context: any) {
        super(props, context);
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
                    <h1>MintCat {packageJson.version}</h1>
                </Flex>
                <Flex gap="middle" justify={"flex-end"} wrap>
                    <BellOutlined />
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
                    <Avatar className={"app-header-avatar"} icon={<UserOutlined/>}/>
                </Flex>
            </Flex>
        );
    }
}

export default TitleBar;