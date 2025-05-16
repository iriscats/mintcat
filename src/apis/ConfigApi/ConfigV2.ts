import {path} from "@tauri-apps/api";
import {appCacheDir, appConfigDir, configDir} from "@tauri-apps/api/path";
import {ConfigDataType, IConfig} from "@/apis/ConfigApi/DataType.ts";
import {exists, stat} from "@tauri-apps/plugin-fs";
import {TimeUtils} from "@/utils/TimeUtils.ts";
import {ConfigApi} from "@/apis/ConfigApi.ts";
import {Setting} from "@/vm/config/Setting.ts";
import {DeviceApi} from "@/apis/DeviceApi.ts";
import {IntegrateApi} from "@/apis/IntegrateApi.ts";
import {ProfileList, ProfileTree, ProfileTreeType} from "@/vm/config/ProfileList.ts";
import {ModList, ModListItem, ModSourceType} from "@/vm/config/ModList.ts";


export class ConfigV2 implements IConfig {

    public configDir: string;
    public modDataPath: string;
    public configPath: string;
    public setting?: Setting;
    public profileList: ProfileList = new ProfileList();
    public profileTreeList: ProfileTree[] = [];
    public modList: ModList = new ModList();

    public constructor(configDir: string = "") {
        this.configDir = configDir;
    }

    private async convertV00ToV02(config: string) {
        try {
            this.setting = new Setting();
            this.setting.version = "0.2.0";
            this.setting.guiTheme = "Light";
            this.setting.cachePath = await appCacheDir();
            this.setting.configPath = await appConfigDir();
            this.setting.language = await DeviceApi.getLanguage();

            const data = JSON.parse(config);
            this.setting.modioOAuth = data["provider_parameters"]["modio"]["oauth"];
            this.setting.drgPakPath = await IntegrateApi.findGamePak();

        } catch (e) {
            console.error(e);
        }
    }

    private async convertModListDataV01ToV02(dataStr: string) {
        const data = JSON.parse(dataStr);

        for (const profile in data.profiles) {
            const profileTree = new ProfileTree(profile);
            let mods = data.profiles[profile]["mods"];

            // 去除 mods 中 ["spec"]["url"] 相同的项
            mods = mods.filter((mod: any, index: number, self: any[]) =>
                index === self.findIndex((t) => (t["spec"]["url"] === mod["spec"]["url"]))
            );

            const localFolder = profileTree.LocalFolder;
            const modioFolder = profileTree.ModioFolder;

            for (const modItem of mods) {
                const item = new ModListItem();
                item.url = modItem["spec"]["url"];
                item.required = modItem["required"];
                item.enabled = modItem["enabled"];
                if (item.url.startsWith("http")) {
                    item.sourceType = ModSourceType.Modio;
                    const addedModItem = this.modList.add(item);
                    modioFolder.add(addedModItem.id, ProfileTreeType.ITEM);
                } else {
                    item.displayName = await path.basename(modItem["spec"]["url"]);
                    item.cachePath = modItem["spec"]["url"];
                    item.sourceType = ModSourceType.Local;
                    item.downloadProgress = 100;
                    const addedModItem = this.modList.add(item);
                    localFolder.add(addedModItem.id, ProfileTreeType.ITEM);
                }
            }

            this.profileTreeList.push(profileTree);
            this.profileList.add(profile);
        }

        console.log(data.active_profile);
        this.profileList.activeProfile = data.active_profile;
        console.log(this.profileList);
    }


    protected async saveConfig() {
        const modData = await ConfigApi.readTextFile(this.modDataPath);
        await this.convertModListDataV01ToV02(modData);

        await ConfigApi.saveModListData(this.modList.toJson());
        await ConfigApi.saveProfileData(this.profileList.toJson());

        for (const profile of this.profileList.Profiles) {
            await ConfigApi.saveProfileDetails(profile,
                this.profileTreeList.find(p => p.name === profile));
        }

        // save setting
        const config = await ConfigApi.readTextFile(this.configPath);
        await this.convertV00ToV02(config);
        await ConfigApi.saveSettings(this.setting.toJson());
    }

    public async loadConfig() {
        this.modDataPath = await path.join(await configDir(), "drg-mod-integration", "config", "mod_data.json");
        this.configPath = await path.join(await configDir(), "drg-mod-integration", "config", "config.json");
        await this.saveConfig();
    }

    public async checkConfig(): Promise<ConfigDataType> {
        this.configDir = await path.join(await configDir(), "drg-mod-integration", "config");
        if (await exists(this.configDir)) {
            const dirInfo = await stat(this.configDir);
            return {
                version: "0.2.0",
                saveTime: TimeUtils.formatDate(dirInfo.mtime),
                path: this.configDir
            }
        } else {
            return undefined
        }
    }


}

