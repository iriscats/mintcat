import {ConfigDataType, IConfig} from "@/storage/DataType.ts";


export class ConfigV5 implements IConfig {


    public async checkConfig(): Promise<ConfigDataType> {
        return Promise.resolve(undefined);
    }

    public async loadConfig(): Promise<void> {
        return Promise.resolve(undefined);
    }


}
