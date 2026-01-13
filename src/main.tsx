import React, {useEffect} from "react";
import {I18nextProvider} from "react-i18next"
import ReactDOM from "react-dom/client";
import {Routes, Route, HashRouter} from "react-router-dom";

import {ConfigProvider, App as AntdApp} from "antd";
import {useEventListener, EventDebugger} from "@/events";

import App from "@/App";
import {AddModDialog} from "@/dialogs/AddModDialog";
import {getDefaultTheme, renderTheme} from "@/themes/default.ts";
import i18n from "@/locales/i18n"
import packageJson from '../package.json';
import {InitLog} from "./apis/LogApi.ts";

InitLog();


const Main = () => {

    const defaultTheme = getDefaultTheme();
    const [theme, setTheme] = React.useState(defaultTheme);

    // ✅ 使用 useEventListener 自动管理清理
    useEventListener("theme-change", (themeValue) => {
        const defaultTheme = renderTheme(themeValue);
        setTheme(defaultTheme);
    });

    useEffect(() => {

        if (packageJson.version.indexOf("beta") > 0) {

            // ✅ 启用 EventDebugger (开发模式)
            EventDebugger.enable({
                consoleLog: true,
                showPayload: true,
                collectStats: true,
            }).then(() => {
                console.log('[EventDebugger] Enabled in development mode');
            });

            const handler = (e: Event) => e.preventDefault();
            document.addEventListener('contextmenu', handler);
            return () => document.removeEventListener('contextmenu', handler);
        }

        renderTheme();

    }, []);

    return (
        <I18nextProvider i18n={i18n}>
            <ConfigProvider theme={theme}>
                <AntdApp>
                    <HashRouter>
                        <Routes>
                            <Route path="/home" element={<App/>}/>
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
