import React, {useEffect} from "react";
import {defaultTheme, renderTheme} from "@/themes/default.ts";
import {ConfigProvider} from "antd";
import {BrowserRouter, Routes, Route} from "react-router-dom";
import ReactDOM from "react-dom/client";
import App from "./App";
import {AddModDialog} from "@/dialogs/AddModDialog";

import i18n from "@/locales/i18n"
import {I18nextProvider} from "react-i18next"
import {listen} from "@tauri-apps/api/event";
import packageJson from '../package.json';

//import {InitLog} from "./apis/LogApi.ts";
//InitLog();


const Main = () => {

    renderTheme();

    try {
        listen("theme-change", () => {
            renderTheme();
            window.location.reload();
        }).then();
    } catch (_) {
    }

    useEffect(() => {
        if (!packageJson.version.endsWith("dev")) {
            const handler = (e) => e.preventDefault();
            document.addEventListener('contextmenu', handler);
            return () => document.removeEventListener('contextmenu', handler);
        }
    }, []);

    return (
        <I18nextProvider i18n={i18n}>
            <ConfigProvider theme={defaultTheme}>
                <BrowserRouter>
                    <Routes>
                        <Route path="/" element={<App/>}/>
                        <Route path="/add_mod_dialog" element={<AddModDialog/>}/>
                    </Routes>
                </BrowserRouter>
            </ConfigProvider>
        </I18nextProvider>
    )
}


ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <Main/>
);
