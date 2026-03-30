import {BasePage} from "../IBasePage.ts";
import {CloudBackupSettings} from "@/pages/SettingPage/CloudBackupSettings.tsx";
import {MintCatSettings} from "@/pages/SettingPage/MintCatSettings.tsx";
import {ThemeSettings} from "@/pages/SettingPage/ThemeSettings.tsx";


export class SettingPage extends BasePage<any, any> {

    public constructor(props: any) {
        super(props);
    }

    componentDidMount(): void {
        this.hookWindowResized();
    }

    render() {
        return (
            <div
                id="scrollableDiv"
                className="scrollable-div"
                style={{ height: window.innerHeight - 81 }}>
                <MintCatSettings/>
                <ThemeSettings/>
                <CloudBackupSettings/>
            </div>
        );
    }
}
