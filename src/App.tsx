import React from 'react';
import {Layout} from 'antd';
import TitleBar from "./components/TitleBar.tsx";
import StatusBar from "./components/StatusBar.tsx";
import MenuBar from "./components/MenuBar.tsx";
import ModListPage from "./pages/ModListPage.tsx";

import './App.css';

const {Header, Footer, Sider, Content} = Layout;


const App: React.FC = () => (
    <Layout className={"app"} style={{backgroundColor: 'transparent'}}>
        <Header className={"app-header"}>
            <TitleBar/>
        </Header>
        <Layout style={{backgroundColor: 'transparent'}}>
            <Sider width="50px" style={{backgroundColor: 'transparent'}}>
                <MenuBar/>
            </Sider>
            <Content style={{backgroundColor: 'transparent', borderRadius: "8px"}}>
                <ModListPage/>
            </Content>
        </Layout>
        <Footer style={{backgroundColor: 'transparent', height: "40px"}}>
            <StatusBar/>
        </Footer>
    </Layout>
);

export default App;