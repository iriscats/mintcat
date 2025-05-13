import React from 'react';
import {BasePage} from "../IBasePage.ts";
import {MintCatSettings} from "@/pages/SettingPage/MintCatSettings.tsx";
import {UserAuthSettings} from "@/pages/SettingPage/UserAuthSettings.tsx";
import {GameSettings} from "@/pages/SettingPage/GameSettings.tsx";


export class SettingPage extends BasePage<any, any> {

    public constructor(props: any) {
        super(props);
    }

    componentDidMount(): void {
        this.hookWindowResized();
        console.log("SettingPage mounted.");
    }

    render() {
        return (
            <div
                id="scrollableDiv"
                style={{
                    height: window.innerHeight - 81,
                    overflow: 'auto',
                    padding: '30px',
                }}>
                <MintCatSettings/>
                <UserAuthSettings/>
                <GameSettings/>
            </div>
        );
    }
}
