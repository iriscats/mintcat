import {locale} from "@tauri-apps/plugin-os";

export class DeviceApi {

    public static async getLanguage() {
        try {
            const userLocale = await locale();
            if (!userLocale) {
                return "en";
            }
            if (userLocale.includes("zh")) {
                return "zh";
            } else if (userLocale.includes("en")) {
                return "en";
            }
        } catch (e) {
        }
    }


}