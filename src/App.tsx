import React from 'react';
import {Flex, Layout, Image, Menu, MenuProps, FloatButton, Button} from 'antd';
import './App.css';
import TitleBar from "./components/TitleBar.tsx";
import StatusBar from "./components/StatusBar.tsx";
import ModListView from "./components/ModListView.tsx";
import {
    AppstoreOutlined,
    ContainerOutlined,
    DesktopOutlined, DownloadOutlined,
    MailOutlined,
    PieChartOutlined, PoweroffOutlined, QuestionCircleOutlined,
    DeleteOutlined,
    SettingOutlined,
    UnorderedListOutlined,
    PlayCircleOutlined,
    SaveOutlined, PlusCircleOutlined
} from "@ant-design/icons";


const {Header, Footer, Sider, Content} = Layout;


type MenuItem = Required<MenuProps>['items'][number];

const items: MenuItem[] = [
    {key: '1', icon: <UnorderedListOutlined/>, label: 'Option 1'},
    {key: '3', icon: <SettingOutlined/>, label: 'Option 3'}
];


const App: React.FC = () => (
    <Layout className={"app"} style={{backgroundColor: 'transparent'}}>
        <Header className={"app-header"}>
            <TitleBar/>
        </Header>
        <Layout style={{backgroundColor: 'transparent'}}>
            <Sider width="50px" style={{backgroundColor: 'transparent'}}>
                <Menu
                    defaultSelectedKeys={['1']}
                    defaultOpenKeys={['sub1']}
                    mode="inline"
                    inlineCollapsed={true}
                    inlineIndent={14}
                    items={items}
                    style={{backgroundColor: 'transparent', height: '100%'}}
                />
            </Sider>
            <Content style={{backgroundColor: 'transparent', borderRadius: "8px"}}>
                <div style={{marginTop:"5px"}}>
                    <Button type="text"><SaveOutlined />Apply Changes</Button>
                    <Button type="text"><DeleteOutlined />Uninstall All</Button>
                    <Button type="text"><PlayCircleOutlined />Launch Game</Button>
                    <Button type="text"><PlusCircleOutlined/>Add Mod</Button>
                </div>
                <ModListView/>
            </Content>
        </Layout>
        <Footer style={{backgroundColor: 'transparent', height: "40px"}}>
            <StatusBar/>
        </Footer>
    </Layout>
);

export default App;