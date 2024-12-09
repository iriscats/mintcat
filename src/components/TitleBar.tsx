import React from "react";
import {Avatar, Flex, Image, Popconfirm} from "antd";
import {QuestionCircleOutlined, SkinOutlined, UserOutlined} from '@ant-design/icons';
import packageJson from '../../package.json';

const TitleBar: React.FC = () => (
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
)

export default TitleBar;