import {message} from "antd";
import {exists} from '@tauri-apps/plugin-fs';
import {appCacheDir} from '@tauri-apps/api/path';
import {ModListViewModel} from "./ModListVM.ts";
import {IntegrateApi} from "../apis/IntegrateApi.ts";
import ConfigApi from "../apis/ConfigApi.ts";
import {Setting} from "./config/Setting.ts";
import {locale} from "@tauri-apps/plugin-os";
import {SettingConverter} from "./converter/SettingConverter.ts";

export class AppViewModel {

    private static instance: AppViewModel;
    private converter: SettingConverter = new SettingConverter();

    public get setting(): Setting {
        return this.converter.setting;
    }

    private constructor() {
    }

    public async checkModList() {
        const viewModel = await ModListViewModel.getInstance();
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
                        const mv = await ModListViewModel.getInstance();
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

        const viewModel = await ModListViewModel.getInstance();
        const modList = viewModel.ActiveProfile.getModList();
        const installModList = [];
        for (const modId of modList) {
            const item = viewModel.ModList.get(modId);
            if (item.enabled) {
                installModList.push({
                    modio_id: item.id,
                    name: item.nameId,
                    pak_path: item.cachePath,
                });
            }
        }
        console.log(installModList);
        await IntegrateApi.install(this.setting.drgPakPath, JSON.stringify(installModList));
    }

    private async checkOauth() {
        if (this.setting.modioOAuth === undefined ||
            this.setting.modioOAuth === null ||
            this.setting.modioOAuth === ""
        ) {
            message.error("mod.io OAuth 不存在!");
        }

    }

    private async checkGamePath() {
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
        if (this.setting.cachePath === "" || this.setting.cachePath === undefined) {
            this.converter.setting.cachePath = await appCacheDir();
        }
        if(this.setting.configPath === "" || this.setting.configPath === undefined) {
            this.converter.setting.configPath = await ConfigApi.getConfigPath();
        }
        await ConfigApi.saveSettings(this.setting.toJson());
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

    public static async getInstance(): Promise<AppViewModel> {
        if (AppViewModel.instance) {
            return AppViewModel.instance;
        }

        const vm = new AppViewModel();
        const settingData = await ConfigApi.loadSettings();
        if (settingData !== undefined) {
            vm.converter.setting = Setting.fromJson(settingData);
        } else {
            const settingDataV1 = await ConfigApi.loadSettingV1();
            if (settingDataV1 !== undefined) {
                vm.converter.convertTo(settingDataV1);
                await ConfigApi.saveSettings(vm.setting.toJson());
            } else {
                vm.converter.setting = new Setting();
            }
        }

        await vm.checkAppPath();
        await vm.checkOauth();
        await vm.checkGamePath();
        await vm.checkLanguage();

        AppViewModel.instance = vm;
        return vm;
    }

}