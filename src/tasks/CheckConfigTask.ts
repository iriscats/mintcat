import {ConfigV2} from "@/storage/model/ConfigV2.ts";
import {ConfigV3} from "@/storage/model/ConfigV3.ts";
import {ConfigV4} from "@/storage/model/ConfigV4.ts";
import {ConfigV5} from "@/storage/model/ConfigV5.ts";
import {ConfigDataType} from "@/storage/DataType.ts";
import {DeviceApi} from "@/apis/DeviceApi.ts";
import { ITask } from 'tauri-plugin-task-queue-api';
import {ConfigManageDialogViewModel} from "@/dialogs/ConfigManageDialog";


class CheckConfigTask implements ITask {

    private isFirstRun: boolean = false;

    public async getExistingConfigList() {
        const configs = [
            new ConfigV2(),
            new ConfigV3(),
            new ConfigV4(),
            new ConfigV5(),
        ];
        const configDataList: ConfigDataType[] = [];
        for (const config of configs) {
            const configData = await config.checkConfig();
            if (configData) {
                configDataList.push(configData);
            }
        }
        return configDataList;
    }

    private checkHasV5Config(configDataList: ConfigDataType[]) {
        return configDataList.some((config) => config.version === "5.0.0");
    }

    public async checkConfig() {



    }

    public async run(): Promise<void> {
        const configDataList = await this.getExistingConfigList();

        // 存在小于 v5 版本的配置文件
        if (configDataList.length > 0 && !this.checkHasV5Config(configDataList)) {
            console.log("exists old config", configDataList);

            this.isFirstRun = await DeviceApi.isFirstRun();
            if (this.isFirstRun) {
                // 第一次运行，打开配置文件迁移弹窗
                await ConfigManageDialogViewModel.open();
            }
            return;
        }
    }


}
