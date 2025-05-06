import {t} from "i18next";
import {message} from "antd";
import {appCacheDir} from '@tauri-apps/api/path';

import {IntegrateApi} from "../apis/IntegrateApi.ts";
import {ConfigApi} from "../apis/ConfigApi.ts";
import {ModUpdateApi} from "../apis/ModUpdateApi.ts";
import {HomeViewModel} from "./HomeViewModel.ts";
import {Setting} from "./config/Setting.ts";
import {SettingConverter} from "./converter/SettingConverter.ts";
import {MessageBox} from "../components/MessageBox.ts";
import i18n from "../locales/i18n"
import {exists} from "@tauri-apps/plugin-fs";
import {ILock} from "@/utils/ILock.ts";
import {emit} from "@tauri-apps/api/event";

const IS_DEV = window.location.host === "localhost:1420";

export class AppViewModel extends ILock {

    private static instance: AppViewModel;
    private converter: SettingConverter = new SettingConverter();

    public isFirstRun: boolean = false;

    public get setting(): Setting {
        return this.converter.setting;
    }

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
                this.converter.setting.cachePath = await appCacheDir();
            }
            if (this.setting.configPath === "" ||
                this.setting.configPath === undefined ||
                !await exists(this.setting.configPath)
            ) {
                this.converter.setting.configPath = await ConfigApi.getConfigPath();
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
        try {
            const settingData = await ConfigApi.loadSettings();
            if (settingData !== undefined) {
                this.converter.setting = Setting.fromJson(settingData);
            } else {
                await this.converter.createDefault();
            }
        } catch (err) {
            await this.converter.createDefault();
        }
    }

    public appStartAutoCheckModUpdate() {
        setTimeout(async () => {
            await ModUpdateApi.checkModUpdate();
        }, 1000 * 120);
    }

    public async loadUserLanguages() {
        let language = this.converter.setting?.language;
        if (language && language !== "") {
            localStorage.setItem('lang', language);
            await i18n.changeLanguage(language)
        }
    }

    private async initAppViewModel() {
        this.isFirstRun = await IntegrateApi.isFirstRun();
        const homeViewModel = await HomeViewModel.getInstance();

        let settingDataV1 = this.isFirstRun ? await ConfigApi.loadSettingV1() : undefined;
        if (settingDataV1 !== undefined) {
            const confirmed = await MessageBox.confirm({
                title: t("Import Config"),
                content: t("Found old version MINT(0.2, 0.3) configuration file, do you want to import and overwrite?"),
            });
            if (confirmed) {
                await this.converter.convertTo(settingDataV1);
                await ConfigApi.saveSettings(this.setting.toJson());
                await homeViewModel.loadOldConfig()
            } else {
                settingDataV1 = undefined;
            }
        }

        if (!settingDataV1 || !this.isFirstRun) {
            await this.loadSettings();
            await homeViewModel.loadConfig()
        }

        await this.loadUserLanguages();
        await this.checkAppPath();

        await IntegrateApi.checkGamePath(this.setting.drgPakPath);

        if (await this.checkOauth()) {
            this.appStartAutoCheckModUpdate();
        } else {
            message.error(t("mod.io OAuth No Found"));
        }

        await emit("title-bar-load-avatar");

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