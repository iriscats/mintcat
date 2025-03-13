import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import {getCurrentWindow} from "@tauri-apps/api/window";
import {warn, debug, trace, info, error} from '@tauri-apps/plugin-log';

try {
    function forwardConsole(
        fnName: 'log' | 'debug' | 'info' | 'warn' | 'error',
        logger: (message: string) => Promise<void>
    ) {
        const original = console[fnName];
        console[fnName] = (message) => {
            original(message);
            logger(message).then(_ => {
            });
        };
    }

    forwardConsole('log', trace);
    forwardConsole('debug', debug);
    forwardConsole('info', info);
    forwardConsole('warn', warn);
    forwardConsole('error', error);
} catch (e) {
}

const appRef: any = React.createRef();
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <App ref={appRef}/>
);


try {
    await getCurrentWindow().onResized(({payload: size}) => {
        appRef.current?.forceUpdate();
    });

    await getCurrentWindow().onDragDropEvent((event) => {
        if (event.payload.type === 'drop') {
            console.log('User dropped', event.payload.paths);
        }
    });

} catch (e) {
}

