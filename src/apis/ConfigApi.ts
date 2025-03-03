import {readTextFile, writeTextFile} from '@tauri-apps/plugin-fs';


class ConfigApi {

    public static async readDataToFile(fileName: string): Promise<string> {
        try {
            return await readTextFile(fileName);
        } catch (error) {
            console.error(`Failed to read file ${fileName}: ${error}`);
            return undefined;
        }
    }

    public static async saveDataToFile(fileName: string, data: string): Promise<boolean> {
        try {
            await writeTextFile(fileName, data);
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
        const fileName = "/Users/bytedance/Desktop/config/mods.json";
        return await ConfigApi.readDataToFile(fileName);
    }

    public static async saveModListData(data: string): Promise<boolean> {
        const fileName = "/Users/bytedance/Desktop/config/mods.json";
        return await ConfigApi.saveDataToFile(fileName, data);
    }

    public static async loadProfileData(): Promise<string> {
        const fileName = "/Users/bytedance/Desktop/config/profile.json";
        return await ConfigApi.readDataToFile(fileName);
    }

    public static async saveProfileData(data: string): Promise<boolean> {
        const fileName = "/Users/bytedance/Desktop/config/profile.json";
        return await ConfigApi.saveDataToFile(fileName, data);
    }

    public static async loadProfileDetails(name: string): Promise<string> {
        const fileName = `/Users/bytedance/Desktop/config/profile_${name}.json`;
        return await ConfigApi.readDataToFile(fileName);
    }

    public static async saveProfileDetails(name: string, data: string): Promise<boolean> {
        const fileName = `/Users/bytedance/Desktop/config/profile_${name}.json`;
        return await ConfigApi.saveDataToFile(fileName, data);
    }

    public static async loadUserData(): Promise<string> {
        const fileName = `/Users/bytedance/Desktop/config/user.json`;
        return await ConfigApi.readDataToFile(fileName);
    }

    public static async saveUserDetails(data: string): Promise<boolean> {
        const fileName = `/Users/bytedance/Desktop/config/user.json`;
        return await ConfigApi.saveDataToFile(fileName, data);
    }

    public static async loadSettings(): Promise<string> {
        const fileName = `/Users/bytedance/Desktop/config/setting.json`;
        return await ConfigApi.readDataToFile(fileName);
    }

    public static async saveSettings(data: string): Promise<boolean> {
        const fileName = `/Users/bytedance/Desktop/config/setting.json`;
        return await ConfigApi.saveDataToFile(fileName, data);
    }

}

export default ConfigApi;
