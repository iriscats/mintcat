import {ConfigDataType} from "@/storage/DataType.ts";
import {TimeUtils} from "@/utils/TimeUtils.ts";
import {IConfig} from "@/storage/model/IConfig.ts";
import {exists, stat} from "@tauri-apps/plugin-fs";
import {configDir} from "@tauri-apps/api/path";

export class ConfigV5 implements IConfig {


    public async checkConfig(): Promise<ConfigDataType> {

        if (await exists(await configDir())) {
            const dirInfo = await stat(await configDir());
            return {
                version: "0.5.0",
                saveTime: TimeUtils.formatDate(dirInfo.mtime),
                path: await configDir(),
            };
        } else {
            return undefined

        }
    }

}