import React from "react";
import {Menu, MenuProps} from "antd";
import {AppstoreAddOutlined, HomeOutlined, SettingOutlined, UnorderedListOutlined} from "@ant-design/icons";
import {ModioOutlined} from "./SvgIcon.tsx";


type MenuItem = Required<MenuProps>['items'][number];

const items: MenuItem[] = [
    {key: 'mod_list', icon: <HomeOutlined/>, label: 'Mod List'},
    {key: 'modio', icon: <ModioOutlined/>, label: 'mod.io'},
    {key: 'settings', icon: <SettingOutlined/>, label: 'Settings'}
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
                defaultSelectedKeys={['1']}
                defaultOpenKeys={['sub1']}
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