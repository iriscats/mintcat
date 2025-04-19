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

const IS_DEV = window.location.host === "localhost:1420";

export class AppViewModel {

    private static instance: AppViewModel;
    private converter: SettingConverter = new SettingConverter();

    public isFirstRun: boolean = false;

    public get setting(): Setting {
        return this.converter.setting;
    }

    private constructor() {
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

    public checkModUpdate() {
        setTimeout(async () => {
            const viewModel = await HomeViewModel.getInstance();

            // 判断最近 1 小时内检查过更新不继续
            if (viewModel.ActiveProfile.lastUpdate && new Date().getTime()
                - viewModel.ActiveProfile.lastUpdate < 1000 * 60 * 60) {
                return;
            }

            await ModUpdateApi.checkModUpdate();
        }, 1000 * 60);
    }

    public async loadTheme() {
        const theme = this.converter.setting.guiTheme
        if (theme === "Light") {
            window.document.documentElement.style.filter = "none";
            // Remove dark mode style tag if exists
            const darkStyle = document.getElementById('dark-theme-style');
            darkStyle?.remove();
        } else if (theme === "Dark") {
            window.document.documentElement.style.filter = "invert(100%)";
            // Create new style element with unique ID
            const style = document.createElement('style');
            style.id = 'dark-theme-style';
            style.textContent = 'img { filter: brightness(0.8) invert(100%); }';
            document.head.appendChild(style);
        }
    }

    public async loadUserLanguages() {
        let language = this.converter.setting?.language;
        if (language && language !== "") {
            localStorage.setItem('lang', language);
            await i18n.changeLanguage(language)
        }
    }

    public static async getInstance(): Promise<AppViewModel> {
        if (AppViewModel.instance) {
            return AppViewModel.instance;
        }
        const appViewModel = new AppViewModel();
        const homeViewModel = await HomeViewModel.getInstance();

        appViewModel.isFirstRun = await IntegrateApi.isFirstRun();
        let settingDataV1 = appViewModel.isFirstRun ? await ConfigApi.loadSettingV1() : undefined;
        if (settingDataV1 !== undefined) {
            const confirmed = await MessageBox.confirm({
                title: t("Import Config"),
                content: t("Found old version MINT(0.2, 0.3) configuration file, do you want to import and overwrite?"),
            });
            if (confirmed) {
                await appViewModel.converter.convertTo(settingDataV1);
                await ConfigApi.saveSettings(appViewModel.setting.toJson());
                await homeViewModel.loadOldConfig()
            } else {
                settingDataV1 = undefined;
            }
        }

        if (!settingDataV1 || !appViewModel.isFirstRun) {
            await appViewModel.loadSettings();
            await homeViewModel.loadConfig()
        }

        await appViewModel.loadUserLanguages();
        await appViewModel.checkAppPath();
        await IntegrateApi.checkGamePath(appViewModel.setting.drgPakPath);

        await appViewModel.loadTheme();
        if (await appViewModel.checkOauth()) {
            appViewModel.checkModUpdate();
        } else {
            message.error(t("mod.io OAuth No Found"));
        }

        AppViewModel.instance = appViewModel;
        return appViewModel;
    }

}