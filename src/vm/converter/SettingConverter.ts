import {appCacheDir, appConfigDir} from "@tauri-apps/api/path";
import {Setting} from "../config/Setting.ts";
import {DeviceApi} from "../../apis/DeviceApi.ts";

export class SettingConverter {

    public setting?: Setting;

    public async createDefault() {
        this.setting = new Setting();
        this.setting.version = "0.2.0";
        this.setting.modioOAuth = "";
        this.setting.drgPakPath = "";
        this.setting.guiTheme = "Light";
        try {
            this.setting.language = await DeviceApi.getLanguage();
            this.setting.cachePath = await appCacheDir();
            this.setting.configPath = await appConfigDir();
        } catch (err) {
        }
    }

    private async convertV00ToV02(config: string) {
        try {
            this.setting = Setting.fromJson(config);
            const data = JSON.parse(config);
            this.setting.version = "0.2.0";
            this.setting.cachePath = await appCacheDir();
            this.setting.configPath = await appConfigDir();
            this.setting.modioOAuth = data["provider_parameters"]["modio"]["oauth"];
        }catch (e) {
            console.error(e);
        }
    }

    public async convertTo(config: string) {
        const data = JSON.parse(config);
        if (data.version === "0.0.0") {
            await this.convertV00ToV02(config);
        } else if (data.version === "0.2.0") {

        }

    }

}