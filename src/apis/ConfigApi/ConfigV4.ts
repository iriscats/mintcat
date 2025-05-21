import {ConfigDataType, IConfig} from "@/apis/ConfigApi/DataType.ts";
import {path} from "@tauri-apps/api";
import {appCacheDir, appConfigDir, configDir} from "@tauri-apps/api/path";
import {exists, stat} from "@tauri-apps/plugin-fs";
import {TimeUtils} from "@/utils/TimeUtils.ts";
import {Setting} from "@/vm/config/Setting.ts";
import {DeviceApi} from "@/apis/DeviceApi.ts";
import {IntegrateApi} from "@/apis/IntegrateApi.ts";
import {ConfigApi} from "@/apis/ConfigApi.ts";
import {ModList} from "@/vm/config/ModList.ts";
import {ProfileList, ProfileTree} from "@/vm/config/ProfileList.ts";
import {t} from "i18next";

export class ConfigV4 implements IConfig {

    public configDir: string;
    public setting?: Setting;
    public profileList: ProfileList = new ProfileList();
    public profileTreeList: ProfileTree[] = [];
    public modList: ModList = new ModList();

    public constructor(configDir: string = "") {
        this.configDir = configDir;
    }

    public async checkConfig(): Promise<ConfigDataType> {
        this.configDir = await path.join(await configDir(), "com.mint.cat");
        if (await exists(this.configDir)) {
            const dirInfo = await stat(this.configDir);
            return {
                version: "0.4.0",
                saveTime: TimeUtils.formatDate(dirInfo.mtime),
                path: this.configDir
            }
        } else {
            return undefined
        }
    }

    public async loadSettingConfig(): Promise<void> {
        try {
            const settingStr = await ConfigApi.loadSettings();
            this.setting = Setting.fromJson(settingStr);
        } catch (err) {
            await this.createDefaultSetting();
        }
    }

    public async loadModDataConfig() {
        try {
            let modList = await ConfigApi.loadModListData();
            if (modList) {
                this.modList = ModList.fromJson(modList);
            } else {
                this.modList = new ModList();
                await ConfigApi.saveModListData(this.modList.toJson());
            }
            this.profileList = ProfileList.fromJson(await ConfigApi.loadProfileData());
            for (const profile of this.profileList.Profiles) {
                const profileDetailData = await ConfigApi.loadProfileDetails(profile);
                if (profileDetailData) {
                    this.profileTreeList.push(ProfileTree.fromJson(profileDetailData));
                } else {
                    // 如果配置丢失，生成空白
                    this.profileTreeList.push(new ProfileTree(profile));
                    await ConfigApi.saveProfileDetails(profile, new ProfileTree(profile));
                }
            }
        } catch (err) {
            console.error(err);
            await this.createDefaultModData();
        }
    }

    public async loadConfig() {
        await this.loadSettingConfig();
        await this.loadModDataConfig();
    }

    private async createDefaultSetting() {
        this.setting = new Setting();
        this.setting.version = "0.2.0";
        this.setting.guiTheme = "Light";
        this.setting.modioOAuth = "";
        this.setting.modioUid = 0;
        this.setting.ue4ss = "UE4SS-Lite";

        try {
            this.setting.language = await DeviceApi.getLanguage();
            this.setting.cachePath = await appCacheDir();
            this.setting.configPath = await appConfigDir();
            this.setting.drgPakPath = await IntegrateApi.findGamePak();
        } catch (e) {
            console.error(e);
        }

        await ConfigApi.saveSettings(this.setting.toJson());
    }

    private async createDefaultModData() {
        this.modList = new ModList();
        this.profileList = new ProfileList();
        this.profileList.Profiles.push(t("Default"));
        this.profileList.activeProfile = t("Default");

        const defaultProfileTree = new ProfileTree(t("Default"));
        this.profileTreeList.push(defaultProfileTree);

        await ConfigApi.saveModListData(this.modList.toJson());
        await ConfigApi.saveProfileData(this.profileList.toJson());
        await ConfigApi.saveProfileDetails(this.profileList.activeProfile, defaultProfileTree);
    }


}