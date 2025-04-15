import {appCacheDir, appConfigDir} from "@tauri-apps/api/path";
import {Setting} from "../config/Setting.ts";
import {DeviceApi} from "../../apis/DeviceApi.ts";
import {IntegrateApi} from "../../apis/IntegrateApi.ts";

export class SettingConverter {

    public setting?: Setting;

    public async createDefault() {
        this.setting = new Setting();
        this.setting.version = "0.2.0";
        this.setting.guiTheme = "Light";
        this.setting.modioOAuth = "";
        try {
            this.setting.language = await DeviceApi.getLanguage();
            this.setting.cachePath = await appCacheDir();
            this.setting.configPath = await appConfigDir();
            this.setting.drgPakPath = await IntegrateApi.findGamePak();
        } catch (err) {
        }
    }

    private async convertV00ToV02(config: string) {
        try {
            this.setting = new Setting();
            this.setting.version = "0.2.0";
            this.setting.cachePath = await appCacheDir();
            this.setting.configPath = await appConfigDir();
            this.setting.language = await DeviceApi.getLanguage();

            const data = JSON.parse(config);
            this.setting.modioOAuth = data["provider_parameters"]["modio"]["oauth"];
            this.setting.drgPakPath = data["drg_pak_path"];
        } catch (e) {
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