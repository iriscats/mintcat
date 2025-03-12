import {BaseDirectory, exists, readTextFile, writeTextFile, mkdir} from '@tauri-apps/plugin-fs';
import {appConfigDir} from "@tauri-apps/api/path";

const IS_DEV = false;
const DEV_PATH = "/Users/bytedance/Desktop/config/";


class ConfigApi {

    public static async getConfigPath() {
        const configDir = await appConfigDir();
        return IS_DEV ? DEV_PATH : configDir;
    }

    public static async readDataToFile(fileName: string): Promise<string> {
        try {
            return await readTextFile(fileName, {
                baseDir: BaseDirectory.AppConfig,
            });
        } catch (error) {
            console.error(`Failed to read file ${fileName}: ${error}`);
            return undefined;
        }
    }

    public static async saveDataToFile(fileName: string, data: string): Promise<boolean> {
        try {
            const configDir = await ConfigApi.getConfigPath();
            if (!await exists(configDir)) {
                await mkdir(configDir)
            }
            await writeTextFile(fileName, data, {
                baseDir: BaseDirectory.AppConfig,
            });
            return true;
        } catch (error) {
            console.error(`Failed to write file ${fileName}: ${error}`);
        }
        return false;
    }

    public static async loadModListDataV1(): Promise<string> {
        const fileName = "/Users/bytedance/Desktop/config/configv1.json";
        return await ConfigApi.readDataToFile(fileName);
    }

    public static async loadModListData(): Promise<string> {
        const fileName = "mods.json";
        return await ConfigApi.readDataToFile(fileName);
    }

    public static async saveModListData(data: string): Promise<boolean> {
        const fileName = "mods.json";
        return await ConfigApi.saveDataToFile(fileName, data);
    }

    public static async loadProfileData(): Promise<string> {
        const fileName = "profile.json";
        return await ConfigApi.readDataToFile(fileName);
    }

    public static async saveProfileData(data: string): Promise<boolean> {
        const fileName = "profile.json";
        return await ConfigApi.saveDataToFile(fileName, data);
    }

    public static async loadProfileDetails(name: string): Promise<string> {
        const fileName = `profile_${name}.json`;
        return await ConfigApi.readDataToFile(fileName);
    }

    public static async saveProfileDetails(name: string, data: string): Promise<boolean> {
        const fileName = `profile_${name}.json`;
        return await ConfigApi.saveDataToFile(fileName, data);
    }

    public static async loadUserData(): Promise<string> {
        const fileName = "user.json";
        return await ConfigApi.readDataToFile(fileName);
    }

    public static async saveUserDetails(data: string): Promise<boolean> {
        const fileName = "user.json";
        return await ConfigApi.saveDataToFile(fileName, data);
    }

    public static async loadSettingV1(): Promise<string> {
        const fileName = "/Users/bytedance/Desktop/config/settings.json";
        return await ConfigApi.readDataToFile(fileName);
    }

    public static async loadSettings(): Promise<string> {
        const fileName = "settings.json";
        return await ConfigApi.readDataToFile(fileName);
    }

    public static async saveSettings(data: string): Promise<boolean> {
        const fileName = "settings.json";
        return await ConfigApi.saveDataToFile(fileName, data);
    }

}

export default ConfigApi;
