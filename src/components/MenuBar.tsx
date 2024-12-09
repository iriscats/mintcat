import React from "react";
import {Menu, MenuProps} from "antd";
import {AppstoreAddOutlined, SettingOutlined, UnorderedListOutlined} from "@ant-design/icons";


type MenuItem = Required<MenuProps>['items'][number];

const items: MenuItem[] = [
    {key: 'mod_list', icon: <UnorderedListOutlined/>, label: 'Mod List'},
    {key: 'modio', icon: <AppstoreAddOutlined/>, label: 'mod.io'},
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