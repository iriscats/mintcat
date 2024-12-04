import React from 'react';
import {Layout, ConfigProvider} from 'antd';
import {I18nextProvider} from "react-i18next"

import TitleBar from "./components/TitleBar.tsx";
import StatusBar from "./components/StatusBar.tsx";
import MenuBar from "./components/MenuBar.tsx";
import ModListPage from "./pages/ModListPage.tsx";
import defaultTheme from './themes/default.ts';
import i18n from "./locales/i18n"

import './App.css';

const {Header, Footer, Sider, Content} = Layout;


const App: React.FC = () => (
    <I18nextProvider i18n={i18n}>
        <ConfigProvider
            theme={defaultTheme}
        >
            <Layout className={"app"}>
                <Header className={"app-header"}>
                    <TitleBar/>
                </Header>
                <Layout>
                    <Sider width="50px">
                        <MenuBar/>
                    </Sider>
                    <Content style={{borderRadius: "8px"}}>
                        <ModListPage/>
                    </Content>
                </Layout>
                <Footer style={{height: "40px"}}>
                    <StatusBar/>
                </Footer>
            </Layout>
        </ConfigProvider>
    </I18nextProvider>
);

export default App;