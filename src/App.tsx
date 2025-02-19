import React from 'react';
import {Layout, ConfigProvider} from 'antd';
import {I18nextProvider} from "react-i18next"

import TitleBar from "./components/TitleBar.tsx";
import StatusBar from "./components/StatusBar.tsx";
import MenuBar from "./components/MenuBar.tsx";
import ModListPage from "./pages/ModListPage.tsx";
import SettingPage from "./pages/SettingPage.tsx";
import ModioPage from "./pages/ModioPage.tsx";

import defaultTheme from './themes/default.ts';
import i18n from "./locales/i18n"

import './App.css';

const {
    Header,
    Footer,
    Sider,
    Content
} = Layout;


class App extends React.Component<any, any> {

    private currentPage: string = "mod_list";

    public constructor(props: any, context: any) {
        super(props, context);
        console.log("App constructor");
    }

    renderContent() {
        switch (this.currentPage) {
            case "mod_list":
                return <ModListPage/>;
            case "modio":
                return <ModioPage/>;
            case "settings":
                return <SettingPage/>;
            default:
                return null;
        }
    }

    render() {
        return (
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
                                <MenuBar onClick={(key) => {
                                    this.currentPage = key;
                                    this.forceUpdate();
                                }}/>
                            </Sider>
                            <Content>
                                {this.renderContent()}
                            </Content>
                        </Layout>
                        <Footer style={{height: "30px"}}>
                            <StatusBar/>
                        </Footer>
                    </Layout>
                </ConfigProvider>
            </I18nextProvider>
        );
    }
}


export default App;