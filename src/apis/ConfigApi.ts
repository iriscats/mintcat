import {BaseDirectory, exists, readTextFile, writeTextFile, mkdir} from '@tauri-apps/plugin-fs';
import {appConfigDir, configDir} from "@tauri-apps/api/path";
import {path} from "@tauri-apps/api";

const IS_DEV = window.location.host === "127.0.0.1";
const DEV_PATH = "~/Desktop/config/";

export class ConfigApi {

    public static async getConfigPath() {
        const configDir = await appConfigDir();
        return IS_DEV ? DEV_PATH : configDir;
    }

    public static async readDataToFile(fileName: string): Promise<string> {
        try {
            let filePath = fileName;
            if (IS_DEV) {
                const configDir = await ConfigApi.getConfigPath();
                filePath = await path.join(configDir, fileName);
            }
            return await readTextFile(filePath, {
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

    public static async saveUserData(data: string): Promise<boolean> {
        const fileName = "user.json";
        return await ConfigApi.saveDataToFile(fileName, data);
    }

    public static async loadSettings(): Promise<string> {
        const fileName = "settings.json";
        return await ConfigApi.readDataToFile(fileName);
    }

    public static async saveSettings(data: string): Promise<boolean> {
        const fileName = "settings.json";
        return await ConfigApi.saveDataToFile(fileName, data);
    }


    public static async loadModListDataV1(): Promise<string> {
        try {
            let oldFilePath = await path.join(await configDir(), "drg-mod-integration\\config\\mod_data.json"); // 0.2
            if (!await exists(oldFilePath)) {
                oldFilePath = await path.join(await configDir(), "mint\\config\\mod_data.json"); // 0.3
            }
            const oldFilePathDev = await path.join(await ConfigApi.getConfigPath(), "configv1.json");
            const fileName = IS_DEV ? oldFilePathDev : oldFilePath;
            return await readTextFile(fileName);
        } catch (error) {
            console.error(error);
            return undefined;
        }
    }

    public static async loadSettingV1(): Promise<string> {
        try {
            let oldFilePath = await path.join(await configDir(), "drg-mod-integration\\config\\config.json"); // 0.2
            if (!await exists(oldFilePath)) {
                oldFilePath = await path.join(await configDir(), "mint\\config\\config.json"); // 0.3
            }
            const oldFilePathDev = await path.join(await ConfigApi.getConfigPath(), "settingsv1.json");
            const fileName = IS_DEV ? oldFilePathDev : oldFilePath;
            return await readTextFile(fileName);
        } catch (error) {
            console.error(error);
            return undefined;
        }
    }

    public static async loadModioUserData(): Promise<string> {
        const fileName = "user.json";
        const oldFilePath = "C:\\Users\\bytedance\\AppData\\Local\\mod.io\\2475\\S-1-5-21-1688096665-3863216114-603340213-1000\\user.json";

        return await ConfigApi.readDataToFile(fileName);
    }


}

