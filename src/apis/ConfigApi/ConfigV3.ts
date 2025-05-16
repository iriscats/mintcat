import {path} from "@tauri-apps/api";
import {configDir} from "@tauri-apps/api/path";
import {ConfigV2} from "@/apis/ConfigApi/ConfigV2.ts";
import {ConfigDataType} from "@/apis/ConfigApi/DataType.ts";
import {exists, stat} from "@tauri-apps/plugin-fs";
import {TimeUtils} from "@/utils/TimeUtils.ts";

export class ConfigV3 extends ConfigV2 {

    public constructor(configDir: string = "") {
        super(configDir);
    }

    public override async loadConfig() {
        this.modDataPath = await path.join(await configDir(), "mint", "config", "mod_data.json");
        this.configPath = await path.join(await configDir(), "mint", "config", "config.json");
        await this.saveConfig();
    }

    public async checkConfig(): Promise<ConfigDataType> {
        this.configDir = await path.join(await configDir(), "mint", "config");
        if (await exists(this.configDir)) {
            const dirInfo = await stat(this.configDir);
            return {
                version: "0.3.0",
                saveTime: TimeUtils.formatDate(dirInfo.mtime),
                path: this.configDir
            }
        } else {
            return undefined
        }
    }

}