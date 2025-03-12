import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { getCurrentWindow } from "@tauri-apps/api/window";

const appRef: any = React.createRef();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <App ref={appRef} />
);

await getCurrentWindow().onResized(({ payload: size }) => {
    appRef.current?.forceUpdate();
});

await getCurrentWindow().onDragDropEvent((event) => {
    if (event.payload.type === 'drop') {
        console.log('User dropped', event.payload.paths);
    }
});