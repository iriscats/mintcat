import React from 'react';
import {Layout} from 'antd';

import TitleBar from "@/components/TitleBar.tsx";
import StatusBar from "@/components/StatusBar.tsx";
import MenuBar, {MenuPage} from "@/components/MenuBar.tsx";
import UpdateDialog from "@/dialogs/UpdateDialog.tsx";
import {initClipboardWatcher} from "@/dialogs/AddModDialog/open.ts";

import {HomePage} from "@/pages/HomePage";
import {ModioPage} from "@/pages/ModioPage";
import {SettingPage} from "@/pages/SettingPage";
import ChatPage from "@/pages/ChatPage.tsx";
import {AppViewModel} from "@/vm/AppViewModel.ts";

import './App.css';
import {EmptyPage} from "@/pages/EmptyPage.tsx";
import {ConfigManageDialog} from "@/dialogs/ConfigManageDialog.tsx";

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

    private pageConfigs = [];

    public constructor(props: any) {
        super(props);

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
            case MenuPage.Chat: {
                this.pageConfigs.push({
                    key: MenuPage.Setting,
                    component: <ChatPage/>
                });
            }
                break;
            default:
                break;
        }
    }

    componentDidMount() {
        AppViewModel.getInstance().then(() => {
            this.pageConfigs.push({key: MenuPage.Home, component: <HomePage/>});
            this.forceUpdate();
        });

        initClipboardWatcher();
        window.addEventListener('keydown', this.handleKeyDown);
    }

    componentWillUnmount() {
        window.removeEventListener('keydown', this.handleKeyDown);
    }

    private handleKeyDown = (event: KeyboardEvent) => {
        if (event.ctrlKey && event.key === 'f') {
            event.preventDefault();
        }
    };


    render() {
        return (
            <Layout className={"app"}>
                <UpdateDialog/>
                <ConfigManageDialog/>
                <Header className={"app-header"}>
                    <TitleBar/>
                </Header>
                <Layout>
                    <Sider width="50px">
                        <MenuBar onClick={this.clickMenu}/>
                    </Sider>
                    <Content>
                        {
                            this.pageConfigs.length === 0 && <EmptyPage/>
                        }
                        {
                            this.pageConfigs.map(({key, component}) => (
                                <div key={key} style={{
                                    display: this.state.currentPage === key ? 'block' : 'none',
                                    height: '100%'
                                }}>
                                    {component}
                                </div>
                            ))
                        }
                    </Content>
                </Layout>
                <Footer style={{height: "30px"}}>
                    <StatusBar/>
                </Footer>
            </Layout>
        );
    }
}


export default App;