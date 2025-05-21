import {t} from "i18next";
import {message} from "antd";
import {appCacheDir} from '@tauri-apps/api/path';

import {IntegrateApi} from "../apis/IntegrateApi.ts";
import {ConfigApi} from "../apis/ConfigApi.ts";
import {ModUpdateApi} from "../apis/ModUpdateApi.ts";
import {HomeViewModel} from "./HomeViewModel.ts";
import {Setting} from "./config/Setting.ts";
import i18n from "../locales/i18n"
import {exists} from "@tauri-apps/plugin-fs";
import {ILock} from "@/utils/ILock.ts";
import {emit} from "@tauri-apps/api/event";
import {ConfigV4} from "@/apis/ConfigApi/ConfigV4.ts";
import {DeviceApi} from "@/apis/DeviceApi.ts";

export class AppViewModel extends ILock {

    private static instance: AppViewModel;
    public isFirstRun: boolean = false;
    public setting: Setting;

    private constructor() {
        super();
    }

    public async checkOauth(): Promise<boolean> {
        return !(!this.setting.modioOAuth || this.setting.modioOAuth === "");
    }

    public async checkAppPath() {
        try {
            if (this.setting.cachePath === "" ||
                this.setting.cachePath === undefined ||
                !await exists(this.setting.cachePath)) {
                this.setting.cachePath = await appCacheDir();
            }
            if (this.setting.configPath === "" ||
                this.setting.configPath === undefined ||
                !await exists(this.setting.configPath)
            ) {
                this.setting.configPath = await ConfigApi.getConfigPath();
            }
            await ConfigApi.saveSettings(this.setting.toJson());
        } catch (err) {
            message.error(t("No Permission To Access the Config Folder"));
        }
    }

    public async saveSettings() {
        await ConfigApi.saveSettings(this.setting.toJson());
    }

    public async loadSettings() {
        const config = new ConfigV4();
        await config.loadConfig();
        this.setting = config.setting;

        const homeViewModel = await HomeViewModel.getInstance();
        await homeViewModel.loadConfig(config);
    }

    public appStartAutoCheckModUpdate() {
        setTimeout(async () => {
            await ModUpdateApi.checkModUpdate();
        }, 1000 * 120);
    }

    public async loadUserLanguages() {
        let language = this.setting?.language;
        if (language && language !== "") {
            localStorage.setItem('lang', language);
            await i18n.changeLanguage(language)
        }
    }

    private async initAppViewModel() {
        this.isFirstRun = await DeviceApi.isFirstRun();
        await this.loadSettings();

        await this.loadUserLanguages();
        await this.checkAppPath();

        await IntegrateApi.checkGamePath(this.setting.drgPakPath);

        if (await this.checkOauth()) {
            this.appStartAutoCheckModUpdate();
        } else {
            message.error(t("mod.io OAuth No Found"));
        }

        await emit("theme-change", this.setting.guiTheme);
        await emit("title-bar-load-avatar");
        if (this.isFirstRun) {
            await emit("config-manage-dialog-open");
        }
    }

    public static async getInstance(): Promise<AppViewModel> {
        const release = await this.acquireLock();
        if (!AppViewModel.instance) {
            const appViewModel = new AppViewModel();
            try {
                await appViewModel.initAppViewModel();
            } finally {
                AppViewModel.instance = appViewModel;
            }
        }
        release();
        return AppViewModel.instance;
    }

}