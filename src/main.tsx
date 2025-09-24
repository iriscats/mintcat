import React, {useEffect} from "react";
import {I18nextProvider} from "react-i18next"
import ReactDOM from "react-dom/client";
import {Routes, Route, HashRouter} from "react-router-dom";

import {ConfigProvider} from "antd";
import '@ant-design/v5-patch-for-react-19';
import {listen} from "@tauri-apps/api/event";

import App from "@/App";
import {AddModDialog} from "@/dialogs/AddModDialog";
import {getDefaultTheme, renderTheme} from "@/themes/default.ts";
import i18n from "@/locales/i18n"
import packageJson from '../package.json';

//import {InitLog} from "./apis/LogApi.ts";
//InitLog();


const Main = () => {

    const defaultTheme = getDefaultTheme();
    const [theme, setTheme] = React.useState(defaultTheme);

    try {
        listen<string>("theme-change", (event) => {
            const defaultTheme = renderTheme(event.payload);
            setTheme(defaultTheme);
        }).then();
    } catch (_) {
    }

    useEffect(() => {
        if (!packageJson.version.endsWith("dev")) {
            const handler = (e) => e.preventDefault();
            document.addEventListener('contextmenu', handler);
            return () => document.removeEventListener('contextmenu', handler);
        }

        renderTheme();
    }, []);

    return (
        <I18nextProvider i18n={i18n}>
            <ConfigProvider theme={theme}>
                <HashRouter>
                    <Routes>
                        <Route path="/home" element={<App/>}/>
                        <Route path="/add_mod_dialog" element={<AddModDialog/>}/>
                    </Routes>
                </HashRouter>
            </ConfigProvider>
        </I18nextProvider>
    )
}



ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <Main/>
);
