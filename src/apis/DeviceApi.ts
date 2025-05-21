import {locale} from "@tauri-apps/plugin-os";
import {Store} from '@tauri-apps/plugin-store';
import {getVersion} from '@tauri-apps/api/app';


export class DeviceApi {

    public static async getLanguage() {
        try {
            const userLocale = await locale();
            console.log(userLocale);
            if (!userLocale) {
                return "en";
            }
            if (userLocale.includes("zh")) {
                return "zh";
            } else if (userLocale.includes("en")) {
                return "en";
            }
        } catch (e) {
            console.log(e);
            return "en";
        }
    }


    public static async isFirstRun() {
        const store = await Store.load('running.dat');
        const currentVersion = await getVersion();
        const key = `firstRun_${currentVersion}`; // 每个版本独立的键
        const hasRun = await store.get<boolean>(key);
        if (!hasRun) {
            console.log(`🆕 First run for version ${currentVersion}`);
            // 执行初始化操作，例如迁移数据、显示欢迎页等
            await store.set(key, true);
            await store.save();
        } else {
            console.log(`🔁 Already ran version ${currentVersion}`);
            return false;
        }

        return true;
    }

}