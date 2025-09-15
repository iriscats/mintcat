import {path} from "@tauri-apps/api";
import {configDir} from "@tauri-apps/api/path";
import {ConfigDataType} from "@/storage/DataType.ts";
import {exists, stat} from "@tauri-apps/plugin-fs";
import {TimeUtils} from "@/utils/TimeUtils.ts";
import {IConfig} from "@/storage/model/IConfig.ts";


export class ConfigV2 implements IConfig {

    public async checkConfig(): Promise<ConfigDataType> {
        const fullConfigDir = await path.join(await configDir(), "drg-mod-integration", "config");
        if (await exists(fullConfigDir)) {
            const dirInfo = await stat(fullConfigDir);
            return {
                version: "0.2.0",
                saveTime: TimeUtils.formatDate(dirInfo.mtime),
                path: fullConfigDir
            }
        } else {
            return undefined
        }
    }
}

