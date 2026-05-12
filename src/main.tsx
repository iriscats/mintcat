import React, {useEffect} from "react";
import {I18nextProvider} from "react-i18next"
import ReactDOM from "react-dom/client";
import {Routes, Route, HashRouter} from "react-router-dom";

import {ConfigProvider, App as AntdApp} from "antd";
import {getCurrentWindow} from "@tauri-apps/api/window";
import {useEventListener, enableEventDebugger} from "@/events";

import App from "@/App";
import {AddModDialog} from "@/dialogs/AddModDialog";
import {MessageBoxThemeBridge} from "@/components/MessageBox.ts";
import {getDefaultTheme, renderTheme} from "@/themes/default.ts";
import i18n from "@/locales/i18n"
import packageJson from '../package.json';
import {InitLog} from "./apis/LogApi.ts";
import {initializeTaskSystem} from "@/tasks";
import {registerIoC} from "@/core/IoCRegistration.ts";
import {confirmFrontendUpdateIfHot} from "@/utils/FrontendUpdateRuntime.ts";

InitLog();
registerIoC();
const isMainWindow = getCurrentWindow().label === 'main';

if (isMainWindow) {
    initializeTaskSystem()
        .then(() => console.log('[Main] Task system initialized (startup)'))
        .catch((error) => console.error('[Main] Failed to initialize task system (startup):', error));
}


const Main = () => {

    const defaultTheme = getDefaultTheme();
    const [theme, setTheme] = React.useState(defaultTheme);

    // ✅ 使用 useEventListener 自动管理清理
    useEventListener("theme-change", (themeValue) => {
        const defaultTheme = renderTheme(themeValue);
        setTheme(defaultTheme);
    });

    useEffect(() => {
        // Task system initialized at startup

        let cleanupContextMenu: (() => void) | undefined;

        if (packageJson.version.indexOf("beta") > 0) {
            // ✅ 启用 EventDebugger (开发模式)
            enableEventDebugger({
                consoleLog: true,
                showPayload: true,
                collectStats: true,
            }).then(() => {
                console.log('[EventDebugger] Enabled in development mode');
            });
        } else {
            const handler = (e: Event) => e.preventDefault();
            document.addEventListener('contextmenu', handler);
            cleanupContextMenu = () => document.removeEventListener('contextmenu', handler);
        }

        renderTheme();

        confirmFrontendUpdateIfHot()
            .catch((error) => console.warn('[FrontendUpdate] Failed to confirm frontend update:', error));

        return cleanupContextMenu;

    }, []);

    return (
        <I18nextProvider i18n={i18n}>
            <ConfigProvider theme={theme}>
                <AntdApp>
                    <MessageBoxThemeBridge/>
                    <HashRouter>
                        <Routes>
                            <Route path="/*" element={<App/>}/>
                            <Route path="/add_mod_dialog" element={<AddModDialog/>}/>
                        </Routes>
                    </HashRouter>
                </AntdApp>
            </ConfigProvider>
        </I18nextProvider>
    )
}



ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <Main/>
);
