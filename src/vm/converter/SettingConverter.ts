import {Setting} from "../config/Setting.ts";
import {appCacheDir, appConfigDir} from "@tauri-apps/api/path";

export class SettingConverter {

    public setting?: Setting;

    private async convertV00ToV02(config: string) {
        this.setting = Setting.fromJson(config);
        const data = JSON.parse(config);
        this.setting.version = "0.2.0";
        this.setting.modioOAuth = data["provider_parameters"]["modio"]["oauth"];
        this.setting.cachePath = await appCacheDir();
        this.setting.configPath = await appConfigDir();
    }

    public async convertTo(config: string) {
        const data = JSON.parse(config);
        if (data.version === "0.0.0") {
            await this.convertV00ToV02(config);
        } else if (data.version === "0.2.0") {

        }

    }

}