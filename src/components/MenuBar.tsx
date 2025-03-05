import React from "react";
import {Menu, MenuProps} from "antd";
import {HomeOutlined, SettingOutlined} from "@ant-design/icons";
import {ModioOutlined} from "./SvgIcon.tsx";


type MenuItem = Required<MenuProps>['items'][number];

export enum MenuPage {
    Home = 'home',
    Setting = 'setting',
    Modio = 'modio'
}

const items: MenuItem[] = [
    {key: MenuPage.Home, icon: <HomeOutlined/>, label: 'Home'},
    {key: MenuPage.Modio, icon: <ModioOutlined/>, label: 'mod.io'},
    {key: MenuPage.Setting, icon: <SettingOutlined/>, label: 'Settings'}
];

interface MenuBarProps {
    onClick: (key: string) => void;
}

class MenuBar extends React.Component<MenuBarProps, any> {

    public constructor(props: any, context: any) {
        super(props, context);
    }

    render() {
        return (
            <Menu
                defaultSelectedKeys={['home']}
                mode="inline"
                inlineIndent={14}
                items={items}
                style={{backgroundColor: 'transparent', height: '100%'}}
                onClick={({key}) => {
                    this.props.onClick(key);
                }}
            />
        );
    }
}

export default MenuBar;