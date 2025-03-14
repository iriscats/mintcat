import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";


const appRef: any = React.createRef();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <App ref={appRef}/>
);



