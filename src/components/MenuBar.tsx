import React from "react";
import {Menu, MenuProps} from "antd";
import {SettingOutlined, UnorderedListOutlined} from "@ant-design/icons";


type MenuItem = Required<MenuProps>['items'][number];

const items: MenuItem[] = [
    {key: '1', icon: <UnorderedListOutlined/>, label: 'Option 1'},
    {key: '3', icon: <SettingOutlined/>, label: 'Option 3'}
];


const MenuBar: React.FC = () => (
    <Menu
        defaultSelectedKeys={['1']}
        defaultOpenKeys={['sub1']}
        mode="inline"
        inlineCollapsed={true}
        inlineIndent={14}
        items={items}
        style={{backgroundColor: 'transparent', height: '100%'}}
    />
)

export default MenuBar;