import {readTextFile, writeTextFile} from '@tauri-apps/plugin-fs';


class ConfigApi {


    public static async saveDataToFile(fileName: string, data: string) {
        try {
            await writeTextFile(fileName, data);
            return true;
        } catch (error) {
            console.error(`Failed to save data to file ${fileName}: ${error}`);
        }
        return false;
    }


    public static async loadConfig(data: string) {
        const fileName = "/Users/bytedance/Desktop/config/a.json";
        return await ConfigApi.saveDataToFile(fileName, data);
    }

    public static async saveConfig(data: string) {
        const fileName = "/Users/bytedance/Desktop/config/a.json";
        try {
            await writeTextFile(fileName, data);
            console.log(`Data saved successfully to file ${fileName}`);
        } catch (error) {
            console.error(`Failed to save data to file ${fileName}: ${error}`);
        }
    }

    public static async loadModListDataV1() {
        const fileName = "/Users/bytedance/Desktop/config/configv1.json";
        try {
            return await readTextFile(fileName);
        } catch (error) {
            console.error(`Failed to save data to file ${fileName}: ${error}`);
        }
    }

    public static async loadModListData() {
        const fileName = "/Users/bytedance/Desktop/config/mods.json";
        try {
            return await readTextFile(fileName);
        } catch (error) {
            console.error(`Failed to save data to file ${fileName}: ${error}`);
        }
    }

    public static async saveModListData(data: string) {
        const fileName = "/Users/bytedance/Desktop/config/a.json";
        try {
            await writeTextFile(fileName, data);
            console.log(`Data saved successfully to file ${fileName}`);
        } catch (error) {
            console.error(`Failed to save data to file ${fileName}: ${error}`);
        }
    }


    public static async loadProfileData() {

    }

    public static async saveProfileData(data: string) {

    }

    public static async loadProfileDetails() {

    }

    public static async saveProfileDetails() {

    }

    public static async loadUserData(data: string) {

    }

    public static async saveUserDetails() {

    }

    public static async loadSettings(): Promise<void> {

    }

    public static async saveSettings(data: string): Promise<void> {

    }

}

export default ConfigApi;
