import {message, Modal} from "antd";
import {exists} from '@tauri-apps/plugin-fs';
import {locale} from "@tauri-apps/plugin-os";
import {appCacheDir} from '@tauri-apps/api/path';

import {IntegrateApi} from "../apis/IntegrateApi.ts";
import {ConfigApi} from "../apis/ConfigApi.ts";
import {HomeViewModel} from "./HomeViewModel.ts";
import {Setting} from "./config/Setting.ts";
import {SettingConverter} from "./converter/SettingConverter.ts";
import {MessageBox} from "../components/MessageBox.ts";

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
        const modList = viewModel.ActiveProfile.getModList();
        for (const modId of modList) {
            const item = viewModel.ModList.get(modId);
            if (item.enabled) {
                if (item.isLocal === true) {
                    if (!await exists(item.cachePath)) {
                        message.error("文件不存在 !" + item.cachePath);
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
                title: '安装提示',
                content: '检测到旧版 MINT(0.2, 0.3) 安装文件，是否卸载?',
            });
            if (!result) {
                message.warning("用户取消安装!");
                return;
            }
        }

        await IntegrateApi.uninstall(this.setting.drgPakPath);

        const viewModel = await HomeViewModel.getInstance();
        const modList = viewModel.ActiveProfile.getModList();
        const installModList = [];
        for (const modId of modList) {
            const item = viewModel.ModList.get(modId);
            const modName = item.nameId === ""? item.displayName : item.nameId;
            if (item.enabled) {
                installModList.push({
                    modio_id: item.modId,
                    name: modName,
                    pak_path: item.cachePath,
                });
            }
        }
        await IntegrateApi.install(this.setting.drgPakPath, JSON.stringify(installModList));
    }

    private async checkOauth(): Promise<boolean> {
        if (!this.setting.modioOAuth || this.setting.modioOAuth === "") {
            message.error("mod.io OAuth 不存在!");
            return false;
        }
        return true;
    }

    private async checkGamePath(): Promise<boolean> {
        if (this.setting.drgPakPath !== undefined) {
            try {
                if (!await exists(this.setting.drgPakPath)) {
                    message.error("游戏路径不存在!");
                    return false;
                }
            } catch (e) {
                message.error("没有权限读取游戏路径! ");
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
            message.error("没有权限获取配置文件夹路径! ");
        }
    }

    private async checkLanguage() {
        try {
            const userLocale = await locale();
            if (!userLocale) {
                message.error("获取语言失败!");
            } else {
                console.log(userLocale);
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
        }
    }

    public static async getInstance(): Promise<AppViewModel> {
        if (AppViewModel.instance) {
            return AppViewModel.instance;
        }
        const appVM = new AppViewModel();
        const modListVM = await HomeViewModel.getInstance();

        appVM.isFirstRun = await IntegrateApi.isFirstRun();

        let settingDataV1 = appVM.isFirstRun ? await ConfigApi.loadSettingV1() : undefined;
        if (settingDataV1 !== undefined) {
            const confirmed = await MessageBox.confirm({
                title: '配置导入',
                content: '发现旧版 MINT(0.2, 0.3) 配置文件，是否导入并覆盖? ',
            });
            if (confirmed) {
                appVM.converter.convertTo(settingDataV1);
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

        await appVM.checkAppPath();
        await appVM.checkOauth();
        await appVM.checkGamePath();
        await appVM.checkLanguage();

        AppViewModel.instance = appVM;
        return appVM;
    }

}