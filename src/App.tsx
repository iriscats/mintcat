import React from 'react';
import {Layout} from 'antd';
import {Route, Routes, useLocation, useNavigate} from 'react-router-dom';
import {useAppError} from '@/hooks/useAppError';
import {useDeepLinkHandler} from '@/hooks/useDeepLinkHandler';
import {useOAuthCallback} from '@/hooks/useOAuthCallback';

import TitleBar from "@/components/TitleBar.tsx";
import StatusBar from "@/components/StatusBar.tsx";
import MenuBar, {MenuPage} from "@/components/MenuBar.tsx";
import UpdateDialog from "@/dialogs/UpdateDialog.tsx";
import {initClipboardWatcher} from "@/dialogs/AddModDialog/open.ts";

import {HomePage} from "@/pages/HomePage";
import {ModioPage} from "@/pages/ModioPage";
import {SettingPage} from "@/pages/SettingPage";
import {AppInitializer} from "@/core/AppInitializer";

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


    const [isAppViewModelReady, setIsAppViewModelReady] = React.useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    const clickMenu = React.useCallback((key: string) => {
        if (key === MenuPage.Home) {
            navigate('/home');
            return;
        }
        navigate(`/home/${key}`);
    }, [navigate]);

    const activeMenuKey = React.useMemo<MenuPage>(() => {
        const trimmed = location.pathname.replace(/^\/home\/?/, '');
        const segment = trimmed.split('/')[0];
        if (!segment) {
            return MenuPage.Home;
        }
        if (Object.values(MenuPage).includes(segment as MenuPage)) {
            return segment as MenuPage;
        }
        return MenuPage.Home;
    }, [location.pathname]);

    useAppError();
    useDeepLinkHandler(isAppViewModelReady);
    useOAuthCallback();
    useKeyboardListener((event) => {
        if (event.ctrlKey && event.key === 'f') {
            event.preventDefault();
        }
    });

    React.useEffect(() => {
        console.log('App 组件加载...');

        // Initialize core (database + AppViewModel)
        AppInitializer.initializeCore()
            .then(async () => {
                console.log('[App] Core initialization complete');
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
                    <MenuBar onClick={clickMenu} activeKey={activeMenuKey}/>
                </Sider>
                <Content>
                    {!isAppViewModelReady && <EmptyPage/>}
                    {isAppViewModelReady && (
                        <Routes>
                            <Route path="/home" element={<HomePage/>}/>
                            <Route path="/home/modio" element={<ModioPage/>}/>
                            <Route path="/home/setting" element={<SettingPage/>}/>
                            <Route path="*" element={<HomePage/>}/>
                        </Routes>
                    )}
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
