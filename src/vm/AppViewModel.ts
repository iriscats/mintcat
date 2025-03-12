import {ModListViewModel} from "./ModListVM.ts";
import {IntegrateApi} from "../apis/IntegrateApi.ts";
import ConfigApi from "../apis/ConfigApi.ts";
import {Setting} from "./config/Setting.ts";
import {exists} from '@tauri-apps/plugin-fs';
import {message} from "antd";

export class AppViewModel {

    public setting?: Setting;
    private static instance: AppViewModel;

    private constructor() {
    }

    public async installMods() {
        const viewModel = await ModListViewModel.getInstance();
        const installModList = [];
        for (const item of viewModel.ModList.Mods) {
            if (item.enabled) {
                installModList.push({
                    modio_id: item.id,
                    name: item.nameId,
                    pak_path: item.cachePath,
                });
            }
        }
        await IntegrateApi.install(this.setting?.drgPakPath, JSON.stringify(installModList));
    }


    public async checkOauth() {
        if (this.setting?.modioOAuth === undefined ||
            this.setting.modioOAuth === null ||
            this.setting?.modioOAuth === ""
        ) {
            message.error("mod.io OAuth 不存在!");
        }


    }

    public async checkGamePath() {
        if (this.setting?.drgPakPath !== undefined) {
            try {
                if (!await exists(this.setting?.drgPakPath)) {
                    message.error("游戏路径不存在!");
                }
            } catch (e) {
                message.error("没有权限读取游戏路径! ");
            }
        }
    }

    public static async getInstance(): Promise<AppViewModel> {
        if (AppViewModel.instance) {
            return AppViewModel.instance;
        }

        const vm = new AppViewModel();

        const settingData = await ConfigApi.loadSettings();
        if (settingData !== undefined) {
            vm.setting = Setting.fromJson(settingData);

        } else {
            const settingDataV1 = await ConfigApi.loadSettingV1();
            vm.setting = Setting.fromJson(settingDataV1);
            await ConfigApi.saveSettings(vm.setting!.toJson());
        }

        await vm.checkOauth();
        await vm.checkGamePath();

        AppViewModel.instance = vm;
        return vm;
    }

}