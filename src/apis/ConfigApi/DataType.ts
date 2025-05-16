export interface ConfigDataType {
    version: string;
    saveTime: string;
    path: string;
}

export interface IConfig {

    checkConfig(): Promise<ConfigDataType>;

    loadConfig(): Promise<void>;
}