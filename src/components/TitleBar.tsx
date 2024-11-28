import {Avatar, Flex, Image} from "antd";
import React from "react";
import {BellOutlined, QuestionCircleOutlined, SkinOutlined, TranslationOutlined, UserOutlined} from '@ant-design/icons';


const TitleBar: React.FC = () => (
    <Flex justify={"space-between"}>
        <Flex gap="middle" wrap>
            <Image
                width={30}
                mask={false}
                preview={false}
                src="icon.ico"
            />
            <h1>MintCat 0.4.0</h1>
        </Flex>
        <Flex gap="middle" justify={"flex-end"} wrap>
            {/*<BellOutlined/>*/}
            <SkinOutlined />
            {/*<TranslationOutlined />*/}
            <QuestionCircleOutlined/>
            <Avatar className={"app-header-avatar"} icon={<UserOutlined/>}/>
        </Flex>
    </Flex>
)

export default TitleBar;