import {message} from "antd";
import {t} from "i18next";
import {exists} from '@tauri-apps/plugin-fs';
import {locale} from "@tauri-apps/plugin-os";
import {appCacheDir, appConfigDir} from '@tauri-apps/api/path';

import {IntegrateApi} from "../apis/IntegrateApi.ts";
import {ConfigApi} from "../apis/ConfigApi.ts";
import {HomeViewModel} from "./HomeViewModel.ts";
import {Setting} from "./config/Setting.ts";
import {SettingConverter} from "./converter/SettingConverter.ts";
import {MessageBox} from "../components/MessageBox.ts";
import {ModioApi} from "../apis/ModioApi.ts";
import {MOD_INVALID_ID} from "./config/ModList.ts";
import {emit, once} from "@tauri-apps/api/event";
import {ModUpdateApi} from "../apis/ModUpdateApi.ts";

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

    public async installMods(callback = undefined) {
        if (!await this.checkGamePath()) {
            return;
        }
        if (!await ModUpdateApi.checkModList()) {
            return;
        }

        const installType = await IntegrateApi.checkInstalled(this.setting.drgPakPath);
        console.log(installType);
        if (installType === "old_version_mint_installed") {
            const result = await MessageBox.confirm({
                title: t("Installation Warning"),
                content: t("Detected old version MINT(0.2, 0.3) installation file, do you want to uninstall?"),
            });
            if (!result) {
                message.warning(t("User Cancels Installation"));
                return;
            }
        }

        await IntegrateApi.uninstall(this.setting.drgPakPath);

        const viewModel = await HomeViewModel.getInstance();
        const subModList = viewModel.ActiveProfile.getModList(viewModel.ModList);
        const installModList = [];
        for (const item of subModList.Mods) {
            const modName = item.nameId === "" ? item.displayName : item.nameId;
            if (item.enabled) {
                installModList.push({
                    modio_id: item.modId,
                    name: modName,
                    pak_path: item.cachePath,
                });
            }
        }

        await IntegrateApi.install(this.setting.drgPakPath, JSON.stringify(installModList));
        await once<string>('install-success', async () => {
            await emit("status-bar-log", t("Installation Finish"));
            callback?.call(this);
        });
    }

    public async uninstall() {
        if (!await this.checkGamePath()) {
            return;
        }
        if (await IntegrateApi.uninstall(this.setting.drgPakPath)) {
            message.success(t("Uninstall Success"));
        }
    }

    public async checkOauth(): Promise<boolean> {
        return !(!this.setting.modioOAuth || this.setting.modioOAuth === "");
    }

    private async checkGamePath(): Promise<boolean> {
        if (this.setting.drgPakPath !== undefined) {
            try {
                if (!await exists(this.setting.drgPakPath)) {
                    message.error(t("Game Path Not Found"));
                    return false;
                }
            } catch (e) {
                message.error(t("No Permission To Access Game Path"));
                return false;
            }
        }
        return true;
    }

    public async checkAppPath() {
        try {
            if (this.setting.cachePath === "" || this.setting.cachePath === undefined) {
                this.converter.setting.cachePath = await appCacheDir();
            }
            if (this.setting.configPath === "" || this.setting.configPath === undefined) {
                this.converter.setting.configPath = await ConfigApi.getConfigPath();
            }
            await ConfigApi.saveSettings(this.setting.toJson());
        } catch (err) {
            message.error(t("No Permission To Access the Config Folder"));
        }
    }

    private async checkSysLanguage() {
        try {
            const userLocale = await locale();
            if (!userLocale) {
                message.error(t("Failed To Get System Info"));
            } else {
                console.log(userLocale);
                if (userLocale.includes("zh")) {
                    if (!localStorage.getItem('lang')) {
                        localStorage.setItem('lang', "zh");
                    }
                } else if (userLocale.includes("en")) {
                    if (!localStorage.getItem('lang')) {
                        localStorage.setItem('lang', "en");
                    }
                }
                return userLocale;
            }
        } catch (e) {
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

    public async checkModUpdate() {
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
            if (!localStorage.getItem('lang')) {
                localStorage.setItem('lang', language)
            }
        }
    }

    public static async getInstance(): Promise<AppViewModel> {
        if (AppViewModel.instance) {
            return AppViewModel.instance;
        }
        const appVM = new AppViewModel();
        const modListVM = await HomeViewModel.getInstance();

        appVM.isFirstRun = await IntegrateApi.isFirstRun();
        await appVM.checkSysLanguage();

        let settingDataV1 = appVM.isFirstRun ? await ConfigApi.loadSettingV1() : undefined;
        if (settingDataV1 !== undefined) {
            const confirmed = await MessageBox.confirm({
                title: t("Import Config"),
                content: t("Found old version MINT(0.2, 0.3) configuration file, do you want to import and overwrite?"),
            });
            if (confirmed) {
                await appVM.converter.convertTo(settingDataV1);
                await ConfigApi.saveSettings(appVM.setting.toJson());
                await modListVM.loadOldConfig()
            } else {
                settingDataV1 = undefined;
            }
        }

        if (!settingDataV1 || !appVM.isFirstRun) {
            await appVM.loadSettings();
            await modListVM.loadConfig()
        }

        await appVM.loadUserLanguages();
        await appVM.checkAppPath();
        await appVM.checkGamePath();
        await appVM.loadTheme();

        if (await appVM.checkOauth()) {
            await appVM.checkModUpdate();
        } else {
            message.error(t("mod.io OAuth No Found"));
        }

        AppViewModel.instance = appVM;
        return appVM;
    }

}