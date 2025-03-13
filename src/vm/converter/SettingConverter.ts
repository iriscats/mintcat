import {Setting} from "../config/Setting.ts";

export class SettingConverter {

    public setting?: Setting;

    private convertV00ToV02(config: string) {
        this.setting = Setting.fromJson(config);
        this.setting.version = "0.2.0";

        const data = JSON.parse(config);
        this.setting.modioOAuth = data["provider_parameters"]["modio"]["oauth"];
    }

    public convertTo(config: string) {
        const data = JSON.parse(config);
        if (data.version === "0.0.0") {
            this.convertV00ToV02(config);
        } else if (data.version === "0.2.0") {

        }

    }

}