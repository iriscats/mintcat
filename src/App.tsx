import React from 'react';
import {Layout, ConfigProvider, message} from 'antd';
import {I18nextProvider} from "react-i18next"
import {getCurrentWindow} from "@tauri-apps/api/window";

import TitleBar from "./components/TitleBar.tsx";
import StatusBar from "./components/StatusBar.tsx";
import MenuBar, {MenuPage} from "./components/MenuBar.tsx";
import HomePage from "./pages/HomePage.tsx";
import SettingPage from "./pages/SettingPage.tsx";
import ModioPage from "./pages/ModioPage.tsx";
import AddModDialog from "./dialogs/AddModDialog.tsx";
import {ProfileTreeGroupType} from "./vm/config/ProfileList.ts";
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

    private currentPage: string = MenuPage.Home;
    private readonly addModDialogRef: React.RefObject<AddModDialog> = React.createRef();

    public constructor(props: any, context: any) {
        super(props, context);
    }

    componentDidMount() {
        try {
            getCurrentWindow().onResized(({payload: size}) => {
                this.forceUpdate();
            }).then(_ => {
            });

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

        } catch (e) {
        }
    }

    render() {
        return (
            <I18nextProvider i18n={i18n}>
                <ConfigProvider
                    theme={defaultTheme}
                >
                    <Layout className={"app"}>
                        <AddModDialog ref={this.addModDialogRef}/>

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
                                {this.currentPage === MenuPage.Home && <HomePage/>}
                                {this.currentPage === MenuPage.Modio && <ModioPage/>}
                                {this.currentPage === MenuPage.Setting && <SettingPage/>}
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