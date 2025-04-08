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
import {emit} from "@tauri-apps/api/event";

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

    public async checkModList() {
        const viewModel = await HomeViewModel.getInstance();
        const subModList = viewModel.ActiveProfile.getModList(viewModel.ModList);
        for (const item of subModList.Mods) {
            if (item.enabled) {
                if (item.isLocal === true) {
                    if (!await exists(item.cachePath)) {
                        message.error(t("File Not Found") + item.cachePath);
                        return false;
                    }
                } else {
                    if (!await exists(item.cachePath)) {
                        const mv = await HomeViewModel.getInstance();
                        await mv.updateMod(item);
                    }
                }
            }
        }
        return true;
    }

    public async installMods() {
        if (!await this.checkGamePath()) {
            return;
        }
        if (!await this.checkModList()) {
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

        await emit("status-bar-log", t("Installation Finish"));
    }

    private async checkOauth(): Promise<boolean> {
        if (!this.setting.modioOAuth || this.setting.modioOAuth === "") {
            message.error(t("mod.io OAuth No Found"));
            return false;
        }
        return true;
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
        const settingData = await ConfigApi.loadSettings();
        if (settingData !== undefined) {
            this.converter.setting = Setting.fromJson(settingData);
        } else {
            this.converter.setting = new Setting();
            this.converter.setting.cachePath = await appCacheDir();
            this.converter.setting.configPath = await appConfigDir();
        }
    }

    public async checkModUpdate() {
        setTimeout(async () => {
            const viewModel = await HomeViewModel.getInstance();
            if (new Date().getTime() - viewModel.ActiveProfile.lastUpdate < 1000 * 60 * 60) {
                return;
            }

            let updateTime = 0;
            if (!viewModel.ActiveProfile.lastUpdate) {
                updateTime = Math.round(new Date().getTime() / 1000) - 60 * 60 * 24 * 30;
            } else {
                updateTime = viewModel.ActiveProfile.lastUpdate;
            }

            const subModList = viewModel.ActiveProfile.getModList(viewModel.ModList);
            const modIdList = [];
            for (const item of subModList.Mods) {
                if (item.isLocal === false || item.modId !== MOD_INVALID_ID) {
                    modIdList.push(item.modId);
                }
            }

            const events = await ModioApi.getEvents(updateTime, modIdList.join(","));
            for (const event of events) {
                console.log(event);
                switch (event.event_type) {
                    case "MODFILE_CHANGED": {
                        let modItem = viewModel.ModList.getByModId(event.mod_id);
                        if (modItem) {
                            modItem.onlineUpdateDate = event.date_added * 1000;
                            if (!modItem.lastUpdateDate) {
                                modItem.lastUpdateDate = 0;
                            }
                        }
                    }
                        break;
                    case "MOD_UNAVAILABLE":
                    case "MOD_DELETED": {
                        let modItem = viewModel.ModList.getByModId(event.mod_id);
                        if (modItem) {
                            modItem.onlineAvailable = false;
                            modItem.lastUpdateDate = event.date_added * 1000;
                            modItem.onlineUpdateDate = event.date_added * 1000;
                        }
                    }
                        break;
                }
            }

            viewModel.ActiveProfile.lastUpdate = new Date().getTime();
            await ConfigApi.saveProfileDetails(viewModel.ActiveProfileName, viewModel.ActiveProfile.toJson());
            await ConfigApi.saveModListData(viewModel.ModList.toJson());
            await viewModel.updateUI();
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
        await appVM.checkOauth();
        await appVM.checkGamePath();
        await appVM.loadTheme();
        await appVM.checkModUpdate();

        AppViewModel.instance = appVM;
        return appVM;
    }

}