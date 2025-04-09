import React from "react";
import {getCurrentWindow} from "@tauri-apps/api/window";

export abstract class BasePage<P, S> extends React.Component<P, S> {
    private isHooked: boolean = false;

    protected hookWindowResized() {
        try {
            if (this.isHooked) {
                return;
            }
            this.isHooked = true;
            getCurrentWindow().onResized(({payload: size}) => {
                this.forceUpdate();
            }).then(_ => {
            });
        } catch (e) {

        }
    }
}
