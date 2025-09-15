import {ConfigDataType} from "@/storage/DataType.ts";

export interface IConfig {

    checkConfig(): Promise<ConfigDataType>;

}