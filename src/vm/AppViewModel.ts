import {message} from "antd";
import {exists} from '@tauri-apps/plugin-fs';

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
        for (const item of viewModel.ModList.Mods) {
            if (item.isLocal === true) {
                if (!await exists(item.cachePath)) {
                    message.error("文件不存在 !" + item.cachePath);
                }
                return;
            } else {
                if (!await exists(item.cachePath)) {
                    const mv = await ModListViewModel.getInstance();
                    await mv.updateMod(item);
                }
            }
        }
    }

    public async installMods() {
        const viewModel = await ModListViewModel.getInstance();
        const installModList = [];
        for (const item of viewModel.ModList.Mods) {

            if (item.enabled) {
                if (item.isLocal === true) {
                    if (!await exists(item.cachePath)) {
                        message.error("文件不存在 !" + item.cachePath);
                    }
                    return;
                } else {
                    if (!await exists(item.cachePath)) {
                        await viewModel.updateMod(item);
                    }
                }
                installModList.push({
                    modio_id: item.id,
                    name: item.nameId,
                    pak_path: item.cachePath,
                });
            }
        }
        await IntegrateApi.install(this.setting.drgPakPath, JSON.stringify(installModList));

        message.success("安装成功!");
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
                }
            } catch (e) {
                message.error("没有权限读取游戏路径! ");
            }
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

        await vm.checkOauth();
        await vm.checkGamePath();
        await vm.checkLanguage();

        AppViewModel.instance = vm;
        return vm;
    }

}