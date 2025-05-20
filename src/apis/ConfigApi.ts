import {path} from "@tauri-apps/api";
import {appConfigDir, configDir} from "@tauri-apps/api/path";
import {BaseDirectory, exists, readTextFile, writeTextFile, mkdir, remove, rename} from '@tauri-apps/plugin-fs';
import {ProfileTree} from "../vm/config/ProfileList.ts";
import {TimeUtils} from "../utils/TimeUtils.ts";
import {ConfigDataType, IConfig} from "@/apis/ConfigApi/DataType.ts";
import {ConfigV4} from "@/apis/ConfigApi/ConfigV4.ts";
import {ConfigV2} from "@/apis/ConfigApi/ConfigV2.ts";
import {ConfigV3} from "@/apis/ConfigApi/ConfigV3.ts";


export class ConfigApi {

    public static async getConfigPath() {
        return await appConfigDir();
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

    public static async deleteProfileDetails(name: string) {
        const fileName = `profile_${name}.json`;
        const profilePath = await path.join(await ConfigApi.getConfigPath(), fileName);
        if (await exists(profilePath)) {
            await remove(profilePath);
        }
    }

    public static async renameProfileDetails(oldName: string, newName: string) {
        const oldFileName = `profile_${oldName}.json`;
        const newFileName = `profile_${newName}.json`;
        const oldProfilePath = await path.join(await ConfigApi.getConfigPath(), oldFileName);
        const newProfilePath = await path.join(await ConfigApi.getConfigPath(), newFileName);
        if (await exists(oldProfilePath)) {
            await rename(oldProfilePath, newProfilePath);
        }
    }

    public static async saveProfileDetails(name: string, tree: ProfileTree, noEdit: boolean = false): Promise<boolean> {
        const fileName = `profile_${name}.json`;
        if (!noEdit)
            tree.editTime = TimeUtils.getCurrentTime();
        return await ConfigApi.saveDataToFile(fileName, tree.toJson());
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

    private static async getModListDataV1Path(): Promise<string> {
        let oldFilePath = await path.join(await configDir(), "drg-mod-integration", "config", "mod_data.json"); // 0.2
        if (!await exists(oldFilePath)) {
            oldFilePath = await path.join(await configDir(), "mint", "config", "mod_data.json"); // 0.3
        }
        return oldFilePath;
    }

    private static async getSettingV1Path(): Promise<string> {
        let oldFilePath = await path.join(await configDir(), "drg-mod-integration", "config", "config.json"); // 0.2
        if (!await exists(oldFilePath)) {
            oldFilePath = await path.join(await configDir(), "mint", "config", "config.json"); // 0.3
        }
        return oldFilePath;
    }

    public static async readTextFile(path: string): Promise<string> {
        try {
            return await readTextFile(path);
        } catch (error) {
            console.error(error);
        }
    }

    public static async loadSettingV1(): Promise<string> {
        try {
            return await readTextFile(await ConfigApi.getSettingV1Path());
        } catch (error) {
            console.error(error);
        }
    }

    public static async getExistingConfigList() {
        const configs = [
            new ConfigV2(),
            new ConfigV3(),
            new ConfigV4(),
        ];
        const configDataList: ConfigDataType[] = [];
        for (const config of configs) {
            const configData = await config.checkConfig();
            if (configData) {
                configDataList.push(configData);
            }
        }
        return configDataList;
    }

    public static async importConfig(configData: ConfigDataType) {
        let config: IConfig;
        switch (configData.version) {
            case "0.2.0":
                config = new ConfigV2();
                break;
            case "0.3.0":
                config = new ConfigV3();
                break;
            case "0.4.0":
            default:
                config = new ConfigV4();
                break;
        }
        await config.loadConfig();
    }

    public static async loadModioUserData(): Promise<string> {
        const fileName = "user.json";
        const oldFilePath = "C:\\Users\\-\\AppData\\Local\\mod.io\\2475\\S-1-5-21-1688096665-3863216114-603340213-1000\\user.json";

        return await ConfigApi.readDataToFile(fileName);
    }

}

