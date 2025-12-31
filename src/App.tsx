import React from 'react';
import {Layout} from 'antd';
import {useAppError} from '@/hooks/useAppError';

import TitleBar from "@/components/TitleBar.tsx";
import StatusBar from "@/components/StatusBar.tsx";
import MenuBar, {MenuPage} from "@/components/MenuBar.tsx";
import UpdateDialog from "@/dialogs/UpdateDialog.tsx";
import {initClipboardWatcher} from "@/dialogs/AddModDialog/open.ts";

import {HomePage} from "@/pages/HomePage";
import {ModioPage} from "@/pages/ModioPage";
import {SettingPage} from "@/pages/SettingPage";
import ChatPage from "@/pages/ChatPage.tsx";
import {AppInitializer} from "@/core/AppInitializer";
import {registerViewModels} from "@/core/IoCRegistration.ts";

import './App.css';
import {EmptyPage} from "@/pages/EmptyPage.tsx";
import {ConfigManageDialog} from "@/dialogs/ConfigManageDialog";

import {SelectGameDialog} from "@/dialogs/SelectGameDialog";
import {useKeyboardListener} from "@/hooks/useKeyboardListener.tsx";
import {emitEvent} from "@/events";

const {
    Header,
    Footer,
    Sider,
    Content
} = Layout;


const AppContent = () => {


    const [currentPage, setCurrentPage] = React.useState<MenuPage>(MenuPage.Home);
    const [isAppViewModelReady, setIsAppViewModelReady] = React.useState(false);
    const pageConfigs = React.useRef<any[]>([]);

    const clickMenu = React.useCallback(async (key: string) => {
        setCurrentPage(key as MenuPage);

        if (pageConfigs.current.find(({key: pageKey}) => pageKey === key)) {
            return;
        }

        switch (key) {
            case MenuPage.Modio: {
                pageConfigs.current.push({
                    key: MenuPage.Modio,
                    component: <ModioPage/>
                });
            }
                break;
            case MenuPage.Setting: {
                pageConfigs.current.push({
                    key: MenuPage.Setting,
                    component: <SettingPage/>
                });
            }
                break;
            case MenuPage.Chat: {
                pageConfigs.current.push({
                    key: MenuPage.Chat,
                    component: <ChatPage/>
                });
            }
                break;
            default:
                break;
        }
    }, []);

    useAppError();
    useKeyboardListener((event) => {
        if (event.ctrlKey && event.key === 'f') {
            event.preventDefault();
        }
    });

    React.useEffect(() => {
        console.log('App 组件加载...');

        // Register all ViewModels to DI container
        registerViewModels();

        // Initialize core (database + AppViewModel)
        AppInitializer.initializeCore()
            .then(() => {
                console.log('[App] Core initialization complete');
                pageConfigs.current.push({key: MenuPage.Home, component: <HomePage/>});
                setIsAppViewModelReady(true);
            })
            .catch((error) => {
                console.error('[App] Core initialization failed:', error);
                // Show error UI
                emitEvent('app-error', error.message || 'Application initialization failed').catch(console.error);
            });

        initClipboardWatcher();

    }, []);


    return (
        <Layout className={"app"}>
            <UpdateDialog/>
            <ConfigManageDialog/>
            <SelectGameDialog/>
            <Header className={"app-header"}>
                <TitleBar/>
            </Header>
            <Layout>
                <Sider width="50px">
                    <MenuBar onClick={clickMenu}/>
                </Sider>
                <Content>
                    {
                        !isAppViewModelReady && <EmptyPage/>
                    }
                    {
                        isAppViewModelReady && pageConfigs.current.map(({key, component}) => (
                            <div key={key} style={{
                                display: currentPage === key ? 'block' : 'none',
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
};

function App() {
    return (
        <AppContent/>
    );
}


export default App;