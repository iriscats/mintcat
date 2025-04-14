import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import {InitLog} from "./apis/LogApi.ts";

//InitLog();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <App/>
);
