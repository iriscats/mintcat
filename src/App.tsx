import React from 'react';
import {Layout, ConfigProvider} from 'antd';
import {I18nextProvider} from "react-i18next"

import TitleBar from "./components/TitleBar.tsx";
import StatusBar from "./components/StatusBar.tsx";
import MenuBar, {MenuPage} from "./components/MenuBar.tsx";
import UpdateDialog from "./dialogs/UpdateDialog.tsx";
import HomePage from "./pages/HomePage.tsx";
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

    state = {
        currentPage: MenuPage.Home,
    }

    private pageConfigs = [
        {key: MenuPage.Home, component: <HomePage/>},
    ];

    public constructor(props: any, context: any) {
        super(props, context);

        this.clickMenu = this.clickMenu.bind(this);
    }

    private async clickMenu(key: string): Promise<void> {
        this.setState({currentPage: key});

        if (this.pageConfigs.find(({key: pageKey}) => pageKey === key)) {
            return;
        }

        switch (key) {
            case MenuPage.Modio: {
                this.pageConfigs.push({
                    key: MenuPage.Modio,
                    component: <ModioPage/>
                });
            }
                break;
            case MenuPage.Setting: {
                this.pageConfigs.push({
                    key: MenuPage.Setting,
                    component: <SettingPage/>
                });
            }
                break;
            default:
                break;
        }
    }

    private async onDragDropEvent() {
        // getCurrentWindow().onDragDropEvent((event) => {
        //     if (event.payload.type === 'drop') {
        //         console.log('User dropped', event.payload);
        //         if (event.payload.paths.length === 0) {
        //             return;
        //         }
        //
        //         this.addModDialogRef.current?.setValue(ProfileTreeGroupType.LOCAL, event.payload.paths[0])
        //             .setCallback(async () => {
        //                 await message.info("Add Successfully");
        //             }).show();
        //     }
        // }).then(_ => {
        // });
    }

    componentDidMount() {
    }

    render() {
        return (
            <I18nextProvider i18n={i18n}>
                <ConfigProvider theme={defaultTheme}>
                    <Layout className={"app"}>
                        <UpdateDialog/>
                        <Header className={"app-header"}>
                            <TitleBar/>
                        </Header>
                        <Layout>
                            <Sider width="50px">
                                <MenuBar onClick={this.clickMenu}/>
                            </Sider>
                            <Content>
                                {this.pageConfigs.map(({key, component}) => (
                                    <div key={key} style={{
                                        display: this.state.currentPage === key ? 'block' : 'none',
                                        height: '100%'
                                    }}>
                                        {component}
                                    </div>
                                ))}
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