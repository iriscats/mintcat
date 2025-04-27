import React from "react";
import {Menu, MenuProps} from "antd";
import {HomeOutlined, SettingOutlined, WechatOutlined} from "@ant-design/icons";
import {ModioOutlined} from "./SvgIcon.tsx";
import {t} from "i18next";


type MenuItem = Required<MenuProps>['items'][number];

export enum MenuPage {
    Home = 'home',
    Setting = 'setting',
    Modio = 'modio',
    Chat = 'chat',
}

interface MenuBarProps {
    onClick: (key: string) => void;
}

class MenuBar extends React.Component<MenuBarProps, any> {

    private items: MenuItem[] = [
        {key: MenuPage.Home, icon: <HomeOutlined/>, label: t("Home")},
        {key: MenuPage.Modio, icon: <ModioOutlined/>, label: 'mod.io'},
        // {key: MenuPage.Chat, icon: <WechatOutlined/>, label: t("Chat")},
        {key: MenuPage.Setting, icon: <SettingOutlined/>, label: t("Settings")},
    ];

    public constructor(props: any, context: any) {
        super(props, context);
    }

    render() {
        return (
            <Menu
                defaultSelectedKeys={['home']}
                mode="inline"
                inlineIndent={14}
                items={this.items}
                style={{backgroundColor: 'transparent', height: '100%'}}
                onClick={({key}) => {
                    this.props.onClick(key);
                }}
            />
        );
    }
}

export default MenuBar;