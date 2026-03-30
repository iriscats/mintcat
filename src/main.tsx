import React, {useEffect} from "react";
import {I18nextProvider} from "react-i18next"
import ReactDOM from "react-dom/client";
import {Routes, Route, HashRouter} from "react-router-dom";

import {ConfigProvider, App as AntdApp} from "antd";
import {useEventListener, enableEventDebugger} from "@/events";

import App from "@/App";
import {AddModDialog} from "@/dialogs/AddModDialog";
import {MessageBoxThemeBridge} from "@/components/MessageBox.ts";
import {getDefaultTheme, renderTheme} from "@/themes/default.ts";
import {ThemePackageService} from "@/services/ThemePackageService.ts";
import i18n from "@/locales/i18n"
import packageJson from '../package.json';
import {InitLog} from "./apis/LogApi.ts";
import {initializeTaskSystem} from "@/tasks";
import {registerIoC} from "@/core/IoCRegistration.ts";

InitLog();
registerIoC();
initializeTaskSystem()
    .then(() => console.log('[Main] Task system initialized (startup)'))
    .catch((error) => console.error('[Main] Failed to initialize task system (startup):', error));

// Initialize task system once for all windows


const Main = () => {

    const defaultTheme = getDefaultTheme();
    const [theme, setTheme] = React.useState(defaultTheme);

    // ✅ 使用 useEventListener 自动管理清理
    useEventListener("theme-package-change", async (themePackageId) => {
        const themePackage = await ThemePackageService.getThemePackageById(themePackageId);
        const cssHref = themePackage ? await ThemePackageService.resolveThemeCssHref(themePackage) : null;
        const nextTheme = await renderTheme(themePackage ?? undefined, cssHref);
        setTheme(nextTheme);
    });

    useEffect(() => {
        // Task system initialized at startup

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
            return () => document.removeEventListener('contextmenu', handler);
        }

        void renderTheme().then(setTheme);

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
