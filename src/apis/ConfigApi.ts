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

    public static async loadModListDataV1(): Promise<string> {
        const fileName = "/Users/bytedance/Desktop/config/configv1.json";
        try {
            return await readTextFile(fileName);
        } catch (error) {
            console.error(`Failed to read data from file ${fileName}: ${error}`);
        }
        return Promise.resolve(JSON.stringify({
            "version": "0.1.0",
            "active_profile": "gameplay",
            "profiles": {
                "default": {
                    "mods": []
                },
                "gameplay": {
                    "mods": [
                        {
                            "spec": {
                                "url": "C:\\Users\\11297\\Desktop\\SteamHelper.zip"
                            },
                            "required": false,
                            "enabled": true
                        },
                        {
                            "spec": {
                                "url": "D:\\mod\\DRGPacker4.27\\FSD-WindowsNoEditor_better_wpn.pak"
                            },
                            "required": false,
                            "enabled": true
                        },
                        {
                            "spec": {
                                "url": "https://mod.io/g/drg/m/drglib#1034237"
                            },
                            "required": false,
                            "enabled": true
                        },
                        {
                            "spec": {
                                "url": "https://mod.io/g/drg/m/mod-hub#1792770"
                            },
                            "required": false,
                            "enabled": true
                        },
                        {
                            "spec": {
                                "url": "https://mod.io/g/drg/m/custom-difficulty#1861561"
                            },
                            "required": true,
                            "enabled": true
                        },
                        {
                            "spec": {
                                "url": "https://mod.io/g/drg/m/sandbox-utilities#1897251"
                            },
                            "required": true,
                            "enabled": true
                        },
                        {
                            "spec": {
                                "url": "https://mod.io/g/drg/m/aichis-beer-selector#2965513"
                            },
                            "required": false,
                            "enabled": true
                        },
                        {
                            "spec": {
                                "url": "https://mod.io/g/drg/m/more-fov#1150682"
                            },
                            "required": false,
                            "enabled": true
                        },
                        {
                            "spec": {
                                "url": "https://mod.io/g/drg/m/brighter-objects#1179441"
                            },
                            "required": false,
                            "enabled": true
                        },
                        {
                            "spec": {
                                "url": "https://mod.io/g/drg/m/low-poly-model-enemies#4189145"
                            },
                            "required": false,
                            "enabled": true
                        },
                        {
                            "spec": {
                                "url": "https://mod.io/g/drg/m/frozen-impact-particles-fps-fix#2285617"
                            },
                            "required": false,
                            "enabled": true
                        },
                        {
                            "spec": {
                                "url": "https://mod.io/g/drg/m/u393#4442796"
                            },
                            "required": false,
                            "enabled": true
                        },
                        {
                            "spec": {
                                "url": "https://mod.io/g/drg/m/monster-quantity-display#3363051"
                            },
                            "required": false,
                            "enabled": true
                        },
                        {
                            "spec": {
                                "url": "https://mod.io/g/drg/m/displays-deep-scan-crystal-on-the-terrain-scanner#4078277"
                            },
                            "required": false,
                            "enabled": true
                        },
                        {
                            "spec": {
                                "url": "https://mod.io/g/drg/m/ammo-percentage-indicator#2613099"
                            },
                            "required": false,
                            "enabled": true
                        },
                        {
                            "spec": {
                                "url": "https://mod.io/g/drg/m/boss-hp-bar-for-big-enemies#3074337"
                            },
                            "required": false,
                            "enabled": true
                        }
                    ]
                }
            },
            "groups": {
                "default": {
                    "mods": []
                }
            }
        }));
    }

    public static async loadModListData() {
        const fileName = "/Users/bytedance/Desktop/config/mods.json";
        try {
            return await readTextFile(fileName);
        } catch (error) {
            console.error(`Failed to read data from file ${fileName}: ${error}`);
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
